"""Cliente HTTP para a API Google Gemini LLM adaptado de interpretar.py."""

import os
import httpx
from loguru import logger
from config.settings import get_settings
from agent.prompts import SYSTEM_PROMPT


class LLMClient:
    """Cliente para interação com o Google Gemini API ou OpenRouter."""

    MODEL = "gemini-2.5-flash"
    DEFAULT_API_KEY = "AQ.Ab8RN6Lg0ISFEf2LHVSiZ4w0j2GPhJLBx2le4dFg98o8rEXgdg"

    def __init__(self):
        settings = get_settings()
        self.use_openrouter = False
        
        # Verificar se openrouter_api_key está configurado e não é o dummy
        or_key = os.environ.get("OPENROUTER_API_KEY") or getattr(settings, "openrouter_api_key", None)
        if or_key and or_key != "dummy" and or_key.strip() != "":
            self.use_openrouter = True
            self.openrouter_api_key = or_key
            self.openrouter_model = os.environ.get("OPENROUTER_MODEL") or getattr(settings, "openrouter_model", None) or "google/gemini-2.5-flash"
            self.api_url = "https://openrouter.ai/api/v1/chat/completions"
            logger.info(f"[LLM] Inicializado via OpenRouter (modelo: {self.openrouter_model})")
        else:
            self.api_key = os.environ.get("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None) or self.DEFAULT_API_KEY
            self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.MODEL}:generateContent?key={self.api_key}"
            logger.info("[LLM] Inicializado via Gemini Direct API")

    async def chat(
        self,
        user_message: str,
        system_prompt: str = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> str:
        """
        Envia mensagem à API do Google Gemini ou OpenRouter e retorna o texto gerado.
        """
        active_system_prompt = system_prompt or SYSTEM_PROMPT
        
        if self.use_openrouter:
            payload = {
                "model": self.openrouter_model,
                "messages": [
                    {"role": "system", "content": active_system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            headers = {
                "Authorization": f"Bearer {self.openrouter_api_key}",
                "Content-Type": "application/json"
            }
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(self.api_url, json=payload, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices", [])
                        if choices:
                            return choices[0].get("message", {}).get("content", "")
                    else:
                        logger.warning(f"[LLM] Erro OpenRouter HTTP {response.status_code}: {response.text[:200]}. Tentando fallback direto para Gemini API...")
            except Exception as e:
                logger.error(f"[LLM] Exceção no OpenRouter: {e}. Tentando fallback direto para Gemini API...")
            
            # Fallback para Gemini Direct caso OpenRouter falhe
            return await self._chat_gemini_direct(user_message, active_system_prompt, temperature, max_tokens)
        else:
            return await self._chat_gemini_direct(user_message, active_system_prompt, temperature, max_tokens)

    async def _chat_gemini_direct(
        self,
        user_message: str,
        active_system_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Chamada direta à API do Google Gemini."""
        settings = get_settings()
        api_key = os.environ.get("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None) or self.DEFAULT_API_KEY
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.MODEL}:generateContent?key={api_key}"
        
        payload = {
            "systemInstruction": {
                "parts": [{"text": active_system_prompt}]
            },
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(api_url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    logger.error(f"[LLM Direct] Erro Gemini Direct HTTP {response.status_code}: {response.text[:200]}")
        except Exception as e:
            logger.error(f"[LLM Direct] Exceção no Gemini Direct: {e}")

        return ""


def get_llm_client() -> LLMClient:
    """Factory para o cliente LLM."""
    return LLMClient()

