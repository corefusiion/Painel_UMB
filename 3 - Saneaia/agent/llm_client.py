"""Cliente HTTP para a API Google Gemini LLM adaptado de interpretar.py."""

import os
import time
import httpx
from loguru import logger
from config.settings import get_settings
from agent.prompts import SYSTEM_PROMPT


class LLMClient:
    """Cliente para interação com o Google Gemini API ou OpenRouter."""

    MODEL = "gemini-2.5-flash"

    def __init__(self):
        self._check_config()

    def _check_config(self):
        settings = get_settings()
        self.use_openrouter = False
        self.has_gemini_key = False
        self._disabled_until = 0

        # 1. Verificar se openrouter_api_key está configurado e válido
        or_key = (os.environ.get("OPENROUTER_API_KEY") or getattr(settings, "openrouter_api_key", None) or "").strip()
        if or_key and or_key.lower() not in ["dummy", "none", ""]:
            self.use_openrouter = True
            self.openrouter_api_key = or_key
            self.openrouter_model = os.environ.get("OPENROUTER_MODEL") or getattr(settings, "openrouter_model", None) or "google/gemini-2.5-flash"
            self.api_url = "https://openrouter.ai/api/v1/chat/completions"
            logger.info(f"[LLM] Provedor ativo: OpenRouter (modelo: {self.openrouter_model})")

        # 2. Verificar se gemini_api_key direta está configurada e válida
        gemini_key = (os.environ.get("GEMINI_API_KEY") or getattr(settings, "gemini_api_key", None) or "").strip()
        if gemini_key and gemini_key.lower() not in ["dummy", "none", ""]:
            self.has_gemini_key = True
            self.gemini_api_key = gemini_key
            self.gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.MODEL}:generateContent?key={self.gemini_api_key}"
            if not self.use_openrouter:
                logger.info(f"[LLM] Provedor ativo: Google Gemini Direct ({self.MODEL})")

        if not self.use_openrouter and not self.has_gemini_key:
            logger.info("[LLM] Nenhuma chave externa de LLM ativa. Modo Local Offline / Determinístico habilitado.")

    @property
    def is_available(self) -> bool:
        """Verifica se há algum provedor configurado e pronto para responder."""
        if time.time() < self._disabled_until:
            return False
        return self.use_openrouter or self.has_gemini_key

    async def chat(
        self,
        user_message: str,
        system_prompt: str = None,
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> str:
        """
        Envia mensagem à API do Google Gemini ou OpenRouter e retorna o texto gerado.
        Caso as APIs externas falhem ou não estejam configuradas, retorna string vazia
        para acionamento imediato do gerador local de respostas.
        """
        if not self.is_available:
            return ""

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
                            return choices[0].get("message", {}).get("content", "") or ""
                    elif response.status_code == 402:
                        logger.warning("[LLM] OpenRouter sem créditos (HTTP 402). Pausando chamadas remotas por 5 min.")
                        self._disabled_until = time.time() + 300
                    else:
                        logger.warning(f"[LLM] OpenRouter retornou status {response.status_code}.")
            except Exception as e:
                logger.warning(f"[LLM] Falha ao comunicar com OpenRouter: {e}")

            # Fallback para Gemini Direct caso tenha chave configurada
            if self.has_gemini_key:
                return await self._chat_gemini_direct(user_message, active_system_prompt, temperature, max_tokens)
            return ""
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
        if not self.has_gemini_key:
            return ""

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
                response = await client.post(self.gemini_url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "") or ""
                elif response.status_code in (401, 403):
                    logger.warning(f"[LLM Direct] Chave do Gemini inválida ou revogada (HTTP {response.status_code}). Desabilitando chamadas diretas.")
                    self.has_gemini_key = False
                else:
                    logger.warning(f"[LLM Direct] Gemini Direct status HTTP {response.status_code}.")
        except Exception as e:
            logger.warning(f"[LLM Direct] Exceção no Gemini Direct: {e}")

        return ""


def get_llm_client() -> LLMClient:
    """Factory para o cliente LLM."""
    return LLMClient()


