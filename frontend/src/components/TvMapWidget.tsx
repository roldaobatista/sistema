import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, AlertCircle, Wrench, User } from 'lucide-react';

// Fix Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- CSS Styles for Pulse Effects ---
const mapStyles = `
    @keyframes pulse-ring {
        0% { transform: scale(0.33); opacity: 1; }
        80%, 100% { opacity: 0; }
    }
    @keyframes pulse-dot {
        0% { transform: scale(0.8); }
        50% { transform: scale(1); }
        100% { transform: scale(0.8); }
    }
    .status-marker { position: relative; }
    .status-marker::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: inherit;
        opacity: 0.6;
        animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }
    .status-marker::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: inherit;
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(0,0,0,.3);
        animation: pulse-dot 2.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) -0.4s infinite;
    }
    .leaflet-popup-content-wrapper {
        background-color: #171717 !important; /* neutral-900 */
        color: white !important;
        border: 1px solid #404040; /* neutral-700 */
        border-radius: 0.5rem;
    }
    .leaflet-popup-tip {
        background-color: #171717 !important;
        border: 1px solid #404040;
    }
    .custom-div-icon {
        background: transparent !important;
        border: none !important;
    }
`;

// --- Custom Icons Definitions ---

const createTechIcon = (status: string, imageUrl?: string) => {
    let color = '#3b82f6'; // blue-500 (transit/default)
    let size = 12;
    let className = 'status-marker';

    if (status === 'working') {
        color = '#f97316'; // orange-500
        size = 16;
    } else if (status === 'available') {
        color = '#22c55e'; // green-500
        size = 12;
        className = ''; // No pulse
    } else if (status === 'offline') {
        color = '#525252'; // neutral-600
        size = 10;
        className = ''; // No pulse
    }

    const html = imageUrl
        ? `<div class="${className}" style="background-color:${color}; width:${size}px; height:${size}px; border-radius:50%; display:flex; align-items:center; justify-content:center; border: 2px solid white;">
             <img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />
           </div>`
        : `<div class="${className}" style="background-color:${color}; width:${size}px; height:${size}px; border-radius:50%; border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`;

    return new L.DivIcon({
        className: 'custom-div-icon',
        html: html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
};

const callIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:#ef4444; width:14px; height:14px; transform: rotate(45deg); border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;">
             <span style="color:white; font-size:10px; font-weight:bold; transform: rotate(-45deg);">!</span>
           </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

const osIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:#22c55e; width:14px; height:14px; border-radius:4px; border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

// --- Components ---

interface TvMapWidgetProps {
    technicians: any[];
    workOrders: any[];
    serviceCalls: any[];
    className?: string;
}

// Automatically fit map bounds to include all markers
const FitBounds = ({ markers }: { markers: L.LatLngExpression[] }) => {
    const map = useMap();

    useEffect(() => {
        if (!markers || markers.length === 0) return;

        try {
            const bounds = L.latLngBounds(markers);
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            }
        } catch (e) {
            console.error("Error fitting bounds", e);
        }
    }, [markers, map]);

    return null;
};

const TvMapWidget: React.FC<TvMapWidgetProps> = ({ technicians, workOrders, serviceCalls, className }) => {

    // Collect all valid coordinates for auto-zoom
    const allMarkers: L.LatLngExpression[] = [];

    technicians?.forEach(t => {
        if (t.location_lat && t.location_lng) allMarkers.push([t.location_lat, t.location_lng]);
    });
    workOrders?.forEach(o => {
        if (o.customer?.latitude) allMarkers.push([o.customer.latitude, o.customer.longitude]);
    });
    serviceCalls?.forEach(s => {
        if (s.customer?.latitude) allMarkers.push([s.customer.latitude, s.customer.longitude]);
    });

    const defaultCenter: L.LatLngExpression = [-23.550520, -46.633308];

    return (
        <div className={`relative w-full h-full rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 ${className}`}>
            <style>{mapStyles}</style>

            <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <FitBounds markers={allMarkers} />

                {/* Technicians */}
                {technicians?.map(tech => (
                    tech.location_lat && (
                        <Marker
                            key={`tech-${tech.id}`}
                            position={[tech.location_lat, tech.location_lng]}
                            icon={createTechIcon(tech.status, tech.avatar_url)}
                        >
                            <Popup>
                                <div className="flex flex-col gap-1 min-w-[120px]">
                                    <div className="text-xs font-bold text-blue-400 flex items-center gap-1">
                                        <Truck size={12} /> {tech.name}
                                    </div>
                                    <div className="text-[10px] uppercase opacity-70 border-t border-neutral-700 pt-1 mt-1">
                                        {tech.status === 'working' ? 'EM ATENDIMENTO' :
                                            tech.status === 'in_transit' ? 'EM DESLOCAMENTO' : tech.status}
                                    </div>
                                    <div className="text-[9px] text-neutral-500">
                                        {new Date(tech.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}

                {/* Service Calls (Open) */}
                {serviceCalls?.map(call => (
                    call.customer?.latitude && (
                        <Marker
                            key={`call-${call.id}`}
                            position={[call.customer.latitude, call.customer.longitude]}
                            icon={callIcon}
                        >
                            <Popup>
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                    <div className="text-xs font-bold text-red-500 flex items-center gap-1">
                                        <AlertCircle size={12} /> CHAMADO #{call.id}
                                    </div>
                                    <div className="font-bold text-[11px]">{call.customer.name}</div>
                                    <div className="text-[10px] text-neutral-400">{call.subject}</div>
                                    <div className="text-[9px] bg-red-900/30 text-red-200 px-1 rounded w-fit mt-1">PRIORIDADE ALTA</div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}

                {/* Active Work Orders */}
                {workOrders?.map(os => (
                    os.customer?.latitude && (
                        <Marker
                            key={`os-${os.id}`}
                            position={[os.customer.latitude, os.customer.longitude]}
                            icon={osIcon}
                        >
                            <Popup>
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                    <div className="text-xs font-bold text-green-400 flex items-center gap-1">
                                        <Wrench size={12} /> OS #{os.os_number || os.id}
                                    </div>
                                    <div className="font-bold text-[11px]">{os.customer.name}</div>
                                    <div className="text-[10px] text-neutral-400 border-t border-neutral-700 pt-1 mt-1">
                                        Técnico: {os.technician?.name || '...'}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>

            {/* Legend Overlay */}
            <div className="absolute bottom-2 right-2 bg-neutral-900/90 backdrop-blur p-3 rounded-lg border border-neutral-800 text-[10px] text-neutral-300 z-[1000] shadow-xl">
                <div className="font-bold mb-2 text-neutral-500 text-[9px] uppercase tracking-wider">Legenda</div>
                <div className="flex items-center gap-2 mb-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"></div> Técnico (Deslocamento)</div>
                <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-lg shadow-orange-500/50"></div> Técnico (Trabalhando)</div>
                <div className="flex items-center gap-2 mb-1.5"><div className="w-2.5 h-2.5 bg-red-500 transform rotate-45 border border-white flex items-center justify-center"><span className="text-[8px] transform -rotate-45 font-bold text-white">!</span></div> Chamado Aberto</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-green-500 rounded-sm border border-white"></div> OS em Execução</div>
            </div>
        </div>
    );
};

export default TvMapWidget;
