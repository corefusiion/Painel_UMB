import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to fix map sizing issues when rendered in dialogs/modals
const InvalidateSize = () => {
  const map = useMap();
  
  useEffect(() => {
    // Wait for dialog animation to complete, then invalidate size
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [map]);
  
  return null;
};

// Custom marker icons by color (fallback for markers without count)
const createCustomIcon = (color: string = 'blue', size: 'small' | 'medium' | 'large' = 'medium'): L.Icon => {
  const sizes: Record<string, [number, number]> = {
    small: [20, 32],
    medium: [25, 41],
    large: [30, 50]
  };
  
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: sizes[size],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Numbered circular marker using DivIcon
const createNumberedIcon = (
  count: number,
  color: 'green' | 'gold' | 'red',
  size: 'small' | 'medium' | 'large'
): L.DivIcon => {
  const sizeMap = {
    small: { dim: 28, text: 'text-xs' },
    medium: { dim: 32, text: 'text-sm' },
    large: { dim: 40, text: 'text-base' },
  };
  
  const colorMap: Record<string, string> = {
    green: '#3d8c40',    // --success: 142 40% 40%
    gold: '#a67c1a',     // --warning: 43 74% 38%
    red: '#7a1414',      // --destructive: 0 80% 27%
  };

  const { dim, text } = sizeMap[size];
  const bgColor = colorMap[color] || colorMap.green;

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${dim}px;
      height: ${dim}px;
      background-color: ${bgColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: ${size === 'large' ? '16px' : size === 'medium' ? '14px' : '12px'};
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">${count}</div>`,
    iconSize: [dim, dim],
    iconAnchor: [dim / 2, dim / 2],
    popupAnchor: [0, -dim / 2],
  });
};

export interface MapMarker {
  id: string;
  position: [number, number];
  color?: 'green' | 'gold' | 'red' | 'blue' | 'orange' | 'yellow' | 'violet' | 'grey' | 'black';
  size?: 'small' | 'medium' | 'large';
  count?: number; // Number to display inside the marker
  popup?: {
    title: string;
    content: string;
  };
}

export interface InteractiveMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  center = [-12.9711, -38.5014], // Salvador, BA
  zoom = 12,
  markers = [],
  onMarkerClick,
  className = '',
  style = { height: '400px', width: '100%' }
}) => {
  return (
    <div className={className} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={true}
      >
        <InvalidateSize />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((marker) => {
          // Use numbered icon if count is provided and color is one of the supported ones
          const icon = marker.count !== undefined && ['green', 'gold', 'red'].includes(marker.color || '')
            ? createNumberedIcon(marker.count, marker.color as 'green' | 'gold' | 'red', marker.size || 'medium')
            : createCustomIcon(marker.color || 'blue', marker.size || 'medium');

          return (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={icon}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(marker)
            }}
          >
            {marker.popup && (
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-foreground">{marker.popup.title}</p>
                  <p className="text-muted-foreground">{marker.popup.content}</p>
                </div>
              </Popup>
            )}
          </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
