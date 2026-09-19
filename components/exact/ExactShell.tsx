'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { useComposerViewport } from './useComposerViewport';
import { exactIconPaths, type ExactIconName } from './icons';

export type ExactPrimary = 'home' | 'map' | 'gav' | 'all' | 'profile';
export type ExactView = ExactPrimary | 'observe' | 'record' | 'history' | 'walk' | 'library' | 'connections' | 'acquaintance' | 'meeting' | 'care' | 'things' | 'editprofile' | 'memory' | 'documents' | 'document' | 'conversation';

export function ExactIcon({ name }: { name: ExactIconName }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: exactIconPaths[name] }} />;
}

const ExactBackContext = createContext<{
  back?: () => void; view?: string; scroll: Map<string, number>;
  register: (back?: () => void, view?: string) => () => void;
}>({ scroll: new Map(), register: () => () => undefined });
export function ExactScope({ children }: { children: ReactNode }) {
  useComposerViewport();
  const [back, setBack] = useState<(() => void) | undefined>();
  const [view, setView] = useState<string | undefined>();
  const [scroll] = useState(() => new Map<string, number>());
  const owner = useRef<symbol | null>(null);
  const register = useCallback((callback?: () => void, nextView?: string) => {
    const token = Symbol('exact-view'); owner.current = token; setBack(() => callback); setView(nextView);
    return () => { if (owner.current === token) { owner.current = null; setBack(undefined); setView(undefined); } };
  }, []);
  return <MotionConfig reducedMotion="user"><ExactBackContext.Provider value={{ back, view, scroll, register }}>{children}</ExactBackContext.Provider></MotionConfig>;
}

export function ExactHeader({ dogName, guest, onHome, onProfile, onBack }: {
  dogName: string; guest: boolean; onHome: () => void; onProfile: () => void; onBack?: () => void;
}) {
  const childBack = useContext(ExactBackContext).back;
  const goBack = childBack || onBack;
  const latestBack = useRef(goBack);
  useLayoutEffect(() => { latestBack.current = goBack; }, [goBack]);
  const hasBack = Boolean(goBack);
  useEffect(() => {
    const button = window.Telegram?.WebApp?.BackButton;
    if (!button) return;
    if (!hasBack) { button.hide(); return; }
    const handleBack = () => {
      // Telegram's native Back lives outside the inert DOM of a modal.
      const modal = document.querySelector<HTMLDialogElement>('dialog:modal');
      if (modal) {
        if (modal.dispatchEvent(new Event('cancel', { cancelable: true }))) modal.close();
        return;
      }
      latestBack.current?.();
    };
    button.onClick(handleBack);
    button.show();
    return () => { button.offClick(handleBack); button.hide(); };
  }, [hasBack]);
  return <header className="exact-header">
    <div className="head-left">
      {goBack && <button type="button" className="icon-button back" aria-label="Назад" onClick={goBack}><ExactIcon name="back" /></button>}
      <a className="brand" href="#today" onClick={event => { event.preventDefault(); onHome(); }}>Псё</a>
    </div>
    <div className="head-right">
      <button type="button" className="dog-switch" onClick={onProfile}><span className="dot" />{dogName}</button>
      <span className="icon-button tiny" aria-label={guest ? 'Демо без синхронизации' : undefined}>{guest ? 'Демо' : ''}</span>
    </div>
  </header>;
}

const navigation: Array<{ view: ExactPrimary; route: 'today' | 'map' | 'nearby' | 'all' | 'profile'; title: string }> = [
  { view: 'home', route: 'today', title: 'Псё' }, { view: 'map', route: 'map', title: 'Карта' },
  { view: 'gav', route: 'nearby', title: 'Гав' }, { view: 'all', route: 'all', title: 'Всё' }, { view: 'profile', route: 'profile', title: 'Профиль' },
];
export function ExactNavigation({ active, onNavigate }: { active: string; onNavigate: (route: 'today' | 'map' | 'nearby' | 'all' | 'profile') => void }) {
  const view = useContext(ExactBackContext).view?.split(':')[0];
  const section = view && ({home:'today',voice:'today',conversation:'today',observe:'today',edit:'today',record:'today',map:'map',walk:'map',gav:'nearby',connections:'nearby',acquaintance:'nearby',meeting:'nearby',all:'all',history:'all',library:'all',care:'all','care-edit':'all','care-create':'all',things:'all',thing:'all',profile:'profile',editprofile:'profile',memory:'profile',documents:'profile',document:'profile',identity:'profile',settings:'profile','public-card':'profile',habits:'profile',diary:'all','map-tools':'map','gav-tools':'nearby','gav-profile':'nearby','gav-filters':'nearby','map-zone':'map'} as Record<string,string>)[view];
  const selected = section || active;
  return <div className="nav-wrap"><nav className="nav app-tabs" aria-label="Основная навигация">{navigation.map(item => <button type="button"
    key={item.view} data-route={item.route} className={selected === item.route ? 'active' : undefined}
    aria-current={selected === item.route ? 'page' : undefined} onClick={() => onNavigate(item.route)}
  >{selected === item.route && <motion.span className="pso-nav-indicator" layoutId="pso-navigation" transition={{duration:.28,ease:[.22,1,.36,1]}} />}<ExactIcon name={item.view} /><span>{item.title}</span></button>)}</nav></div>;
}

export function ExactPage({ children, home = false, viewKey, onBack, active = true }: { children: ReactNode; home?: boolean; viewKey: string; onBack?: () => void; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const latestBack = useRef(onBack);
  useLayoutEffect(() => { latestBack.current = onBack; }, [onBack]);
  const { register, scroll } = useContext(ExactBackContext);
  const hasBack = Boolean(onBack);
  useEffect(() => { if (!active) return; return register(hasBack ? () => latestBack.current?.() : undefined, viewKey); }, [register, viewKey, hasBack, active]);
  useLayoutEffect(() => {
    if (!active) return;
    const content = ref.current?.closest<HTMLElement>('#pso-exact-content');
    if (!content) return;
    content.scrollTop = scroll.get(viewKey) || 0;
    return () => { scroll.set(viewKey, content.scrollTop); };
  }, [active, viewKey, scroll]);
  useEffect(() => {
    if (!active) return;
    const heading = ref.current?.querySelector<HTMLElement>('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [viewKey, active]);
  return <div ref={ref} className={`page${home ? ' home-page' : ''}`} data-exact-view={viewKey}>{children}</div>;
}

export function ExactRow({ title, detail, icon = 'next', onClick, destination }: {
  title: string; detail?: string; icon?: ExactIconName; onClick: () => void; destination?: string;
}) {
  return <button type="button" className="list-row" data-tool-destination={destination} onClick={onClick}>
    {icon !== 'next' && <span className="badge-icon"><ExactIcon name={icon} /></span>}
    <span className="grow"><strong>{title}</strong>{detail && <small>{detail}</small>}</span><ExactIcon name="next" />
  </button>;
}
