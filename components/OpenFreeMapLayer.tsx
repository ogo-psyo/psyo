'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';

const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/positron';
const openFreeMapAttribution = '&copy; <a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

type OpenFreeMapLayerProps = {
  onLoad?: () => void;
  onError?: () => void;
};

export function OpenFreeMapLayer({ onLoad, onError }: OpenFreeMapLayerProps) {
  const map = useMap();
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
  }, [onError, onLoad]);

  useEffect(() => {
    const layer = maplibreGL({
      style: openFreeMapStyle,
      attributionControl: false,
      interactive: false,
    });
    layer.addTo(map);
    const maplibreMap = layer.getMaplibreMap();
    const handleLoad = () => onLoadRef.current?.();
    const handleError = () => onErrorRef.current?.();

    if (maplibreMap.loaded()) handleLoad();
    else maplibreMap.once('load', handleLoad);
    maplibreMap.on('error', handleError);
    map.attributionControl?.addAttribution(openFreeMapAttribution);

    return () => {
      map.attributionControl?.removeAttribution(openFreeMapAttribution);
      maplibreMap.off('load', handleLoad);
      maplibreMap.off('error', handleError);
      layer.remove();
    };
  }, [map]);

  return null;
}
