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
    // WKWebView can lose a GPU context while the app is backgrounded. A single
    // initial `load` event is not a durable readiness signal.
    let disposed = false;
    let failed = false;
    let layer: ReturnType<typeof maplibreGL> | undefined;
    let cleanup = () => {};
    const fail = () => { if (!disposed) { failed = true; onErrorRef.current?.(); } };
    const timer = window.setTimeout(fail, 12_000);
    const ready = () => {
      if (disposed) return;
      failed = false;
      window.clearTimeout(timer);
      onLoadRef.current?.();
    };
    try {
      layer = maplibreGL({ style: openFreeMapStyle, attributionControl: false, interactive: false });
      // Adapter 0.1.4 queues resize work in an uncancellable animation frame;
      // that callback dereferences its map after unmount. Resize synchronously
      // through its public container/size API instead.
      const syncSize = () => {
        if (disposed || !layer) return;
        const gl = layer.getMaplibreMap();
        if (!gl) return;
        const size = layer.getSize();
        const container = layer.getContainer();
        container.style.width = `${size.x}px`;
        container.style.height = `${size.y}px`;
        gl.resize();
      };
      const events = layer.getEvents?.bind(layer);
      layer.getEvents = () => ({ ...events?.(), resize: syncSize });
      layer.addTo(map);
      const gl = layer.getMaplibreMap();
      const canvas = gl.getCanvas();
      const lost = (event: Event) => { event.preventDefault(); fail(); };
      const recover = () => { if (!gl.getCanvas().getContext('webgl2')?.isContextLost() && gl.loaded()) ready(); };
      const resize = () => {
        if (disposed || document.hidden || !map.getContainer().clientWidth || !map.getContainer().clientHeight) return;
        map.invalidateSize({ animate: false, pan: false });
        gl.resize();
        gl.triggerRepaint();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(map.getContainer());
      document.addEventListener('visibilitychange', resize);
      window.addEventListener('pageshow', resize);
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', resize);
      gl.on('load', ready);
      gl.on('error', fail);
      const idle = () => { if (failed) recover(); };
      gl.on('idle', idle);
      if (gl.loaded()) ready();
      map.attributionControl?.addAttribution(openFreeMapAttribution);
      cleanup = () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', resize);
        window.removeEventListener('pageshow', resize);
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('webglcontextrestored', resize);
        gl.off('load', ready); gl.off('error', fail); gl.off('idle', idle);
        map.attributionControl?.removeAttribution(openFreeMapAttribution);
      };
    } catch {
      // A device without a GPU must retain the surrounding list and actions.
      fail();
      if (layer) {
        // Leaflet registers events before onAdd. Let it finish removing a layer
        // whose MapLibre constructor failed, even without a GL map to dispose.
        const remove = layer.onRemove.bind(layer);
        layer.onRemove = target => { try { remove(target); } catch { /* partial initialization */ } return layer!; };
        layer.remove();
        layer = undefined;
      }
    }
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanup();
      // A failed MapLibre constructor can leave a partially attached Leaflet layer.
      try { layer?.remove(); } catch { /* no initialized GL context to dispose */ }
    };
  }, [map]);

  return null;
}
