"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Map as LeafletMap } from "leaflet";
import { categoryMeta, categoryOrder, places, type Place, type PlaceCategory } from "./data";

type Tab = "plan" | "orte" | "gp" | "info";
type Modal = "hotel" | "train" | "transit" | "sos" | "install" | "documents" | null;
type Position = { lat: number; lng: number };

const tabs: { id: Tab; label: string; short: string; icon: string }[] = [
  { id: "plan", label: "Wochenende", short: "Plan", icon: "▦" },
  { id: "orte", label: "Karte & Orte", short: "Karte", icon: "◎" },
  { id: "gp", label: "Sonntag GP", short: "GP", icon: "▰" },
  { id: "info", label: "Infos", short: "Infos", icon: "i" },
];

const ticketUrl = "https://www.ns.nl/kaartjes/bestellen/dutch-grand-prix-dagretour";
const nsPlannerUrl = "https://www.ns.nl/en/journeyplanner/";
const transitPlannerUrl = "https://9292.nl/en/planner";
const gvbTicketsUrl = "https://www.gvb.nl/en/prices";
const circuitMapUrl = "https://dutchgp.com/app/uploads/2026/07/2026_F1_Netherlands_WayfindingMap_Negative_VISUAL.pdf";
const visitorInfoUrl = "https://dutchgp.com/en/visitors-information/";
const goldPlusUrl = "https://dutchgp.com/en/gold-plus-tickets/";
const officialRaceUrl = "https://www.formula1.com/en/latest/article/formula-1-heineken-dutch-grand-prix-2026.VYghWPhEDqYBlWbd1iKe6";
const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const appIconUrl = `${appBasePath}/app-icon.svg`;

function distanceKm(a: Position, b: Position) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function navUrl(place: Place, mode: "walking" | "transit" | "driving") {
  const destination = encodeURIComponent(`${place.name}, ${place.address}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`;
}

function shortcutUrl(name: string) {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

function isHaarlemPlace(place: Place) {
  return place.tags.includes("Haarlem");
}

function QuietMeter({ value }: { value: number }) {
  return <span className="quiet-meter" aria-label={`Ruhefaktor ${value} von 5`} title={`Ruhefaktor ${value}/5`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < value ? "filled" : ""} />)}</span>;
}

function quietLabel(value: number) {
  return ["", "sehr belebt", "eher lebhaft", "mittel", "eher ruhig", "sehr ruhig"][value];
}

function QuietSummary({ value }: { value: number }) {
  return <span className={`quiet-summary q${value}`}><QuietMeter value={value} /><b>{quietLabel(value)}</b></span>;
}

function Overlay({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    document.body.style.top = `-${scrollY}px`;
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return <div className="overlay" role="presentation" onClick={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div><button ref={closeButtonRef} type="button" className="icon-button close-button" onClick={onClose} aria-label="Fenster schließen">×</button></div><div className="modal-content">{children}</div><div className="modal-footer"><button type="button" className="modal-dismiss-button" onClick={onClose}>Fenster schließen</button></div></section></div>;
}

function ActionLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <a className={`action-link${primary ? " primary" : ""}`} href={href} target="_blank" rel="noreferrer">{children}<span aria-hidden="true">↗</span></a>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("plan");
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "alle">("alle");
  const [quietOnly, setQuietOnly] = useState(false);
  const [sort, setSort] = useState<"ruhe" | "name" | "distanz">("ruhe");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [locationError, setLocationError] = useState("");
  const [dark, setDark] = useState(false);
  const [mapScope, setMapScope] = useState<"city" | "route" | "haarlem">("city");
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const savedTheme = localStorage.getItem("nl-f1-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(savedTheme ? savedTheme === "dark" : prefersDark);
      const savedFavorites = localStorage.getItem("nl-f1-favorites");
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("nl-f1-theme", dark ? "dark" : "light"); }, [dark]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${appBasePath}/sw.js`, { scope: `${appBasePath}/` })
      .catch(() => undefined);
  }, []);

  const filteredPlaces = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de");
    const result = places.filter((place) => {
      const matchesCategory = category === "alle" || place.category === category;
      const matchesQuiet = !quietOnly || place.quiet >= 4;
      const matchesScope = mapScope === "haarlem" ? isHaarlemPlace(place) : mapScope === "city" ? !isHaarlemPlace(place) : true;
      const haystack = `${place.name} ${place.kicker} ${place.description} ${place.tags.join(" ")}`.toLocaleLowerCase("de");
      return matchesCategory && matchesQuiet && matchesScope && (!needle || haystack.includes(needle));
    });
    return result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      if (sort === "distanz" && position) return distanceKm(position, a) - distanceKm(position, b);
      if (sort === "ruhe") return b.quiet - a.quiet || a.name.localeCompare(b.name, "de");
      return 0;
    });
  }, [category, mapScope, position, query, quietOnly, sort]);

  useEffect(() => {
    if (tab !== "orte") return;
    let cancelled = false;
    const buildMap = async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      mapRef.current?.remove();
      const node = document.getElementById("trip-map");
      if (!node) return;
      const map = L.map(node, { zoomControl: false, attributionControl: true });
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
      if (mapScope === "route") {
        const line: [number, number][] = [[52.37913, 4.90029], [52.37515, 4.53245], [52.38882, 4.54086]];
        L.polyline(line, { color: "#e74040", weight: 4, opacity: 0.75, dashArray: "8 8" }).addTo(map);
        map.fitBounds(L.latLngBounds(line), { padding: [34, 34] });
      } else if (mapScope === "haarlem") {
        const haarlemStops = filteredPlaces.length ? filteredPlaces : places.filter(isHaarlemPlace);
        if (haarlemStops.length > 1) map.fitBounds(L.latLngBounds(haarlemStops.map((place) => [place.lat, place.lng] as [number, number])), { padding: [44, 44] });
        else map.setView([52.3837, 4.6372], 14);
      } else map.setView([52.3737, 4.8925], 13);
      filteredPlaces.forEach((place) => {
        const meta = categoryMeta[place.category];
        const marker = L.circleMarker([place.lat, place.lng], { radius: place.id === "hotel" ? 11 : 8, color: "#ffffff", weight: 3, fillColor: meta.color, fillOpacity: 1 }).addTo(map);
        marker.bindTooltip(`<strong>${place.name}</strong><br>${meta.label}`, { direction: "top", offset: [0, -6] });
        marker.on("click", () => setSelected(place));
      });
      if (position) L.circleMarker([position.lat, position.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#3478f6", fillOpacity: 1 }).bindTooltip("Mein Standort").addTo(map);
    };
    buildMap();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [filteredPlaces, mapScope, position, tab]);

  const showLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError("Standort wird auf diesem Gerät nicht unterstützt."); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition({ lat: coords.latitude, lng: coords.longitude }); setSort("distanz"); }, () => setLocationError("Standort konnte nicht gelesen werden. Bitte Browserfreigabe prüfen."), { enableHighAccuracy: true, timeout: 12000 });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem("nl-f1-favorites", JSON.stringify(next));
      return next;
    });
  };

  const shareApp = async () => {
    if (navigator.share) await navigator.share({ title: "Amsterdam × Zandvoort 2026", text: "Unser Wochenend-Navigator", url: window.location.href });
    else await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("plan")} aria-label="Zur Startseite"><Image src={appIconUrl} alt="" width={43} height={43} priority /><span><b>Amsterdam × Zandvoort</b><small>21.–23. AUG · NL F1 WEEKEND</small></span></button>
        <nav className="desktop-tabs" aria-label="Hauptnavigation">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
        <div className="top-actions"><button className="icon-button" onClick={() => setModal("sos")} aria-label="Notfallinformationen">SOS</button><button className="icon-button" onClick={() => setModal("documents")} aria-label="Lokale Reisedokumente öffnen">▣</button><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? "Helles Design" : "Dunkles Design"}>{dark ? "☀" : "☾"}</button></div>
      </header>

      <div className="page-wrap">
        {tab === "plan" && <>
          <section className="hero-card">
            <div className="hero-copy"><p className="eyebrow coral">EUER WOCHENENDE · 2 REISENDE</p><h1>Amsterdam in Ruhe.<br /><em>Zandvoort mit Vollgas.</em></h1><p>Ein klarer Plan für Freitagabend bis Sonntagabend – mit Rückzugsorten, günstigen Pausen und dem ganzen GP-Weg.</p><div className="hero-actions"><button className="primary-button" onClick={() => setModal("train")}><span>🚆</span> Zugtickets & Sonntagsplan</button><button className="secondary-button" onClick={() => { setTab("orte"); setQuietOnly(true); }}><span>◌</span> Ruhige Orte</button></div></div>
            <aside className="weekend-pass"><div className="pass-head"><span>DUTCH GP</span><b>GOLD+</b></div><div className="pass-day"><strong>23</strong><span>AUG<br />SONNTAG</span></div><dl><div><dt>START</dt><dd>15:00</dd></div><div><dt>DECK</dt><dd>ab 17:30</dd></div><div><dt>GELÄNDE</dt><dd>bis 21:00</dd></div></dl></aside>
          </section>

          <section className="urgent-card"><div className="urgent-icon">!</div><div><p className="eyebrow">VOR DER ABFAHRT</p><h2>Zugtickets + Amsterdam-ÖPNV</h2><p>2× Dutch GP Dagretour für Zandvoort kaufen. Für Bus, Tram und Metro gibt es daneben die offiziellen GVB-Tickets.</p></div><div className="urgent-actions"><ActionLink href={ticketUrl} primary>NS nach Zandvoort</ActionLink><ActionLink href={gvbTicketsUrl}>GVB-Tickets</ActionLink></div></section>

          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">DER ROTE FADEN</p><h2>Wochenendplan</h2></div><span className="live-pill"><i /> Stand 20.08.2026</span></div>
            <div className="timeline-grid">
              <article className="day-card friday"><div className="day-date"><span>FR</span><strong>21</strong></div><div className="day-body"><p className="eyebrow">ANKOMMEN</p><h3>Freitagabend</h3><ul><li><time>ab 15:00</time><span><b>Check-in möglich</b><small>Kimpton De Witt · Rezeption 24 h</small></span></li><li><time>bei Ankunft</time><span><b>Sonntag kurz klären</b><small>Auto bis spät + Gepäck nach Check-out</small></span></li><li><time>später</time><span><b>Nur noch ankommen</b><small>Café Celia Küche bis 22:00</small></span></li></ul></div></article>
              <article className="day-card saturday"><div className="day-date"><span>SA</span><strong>22</strong></div><div className="day-body"><p className="eyebrow">RUHIGER STADTTAG</p><h3>Samstag nach Energie</h3><ul><li><time>07–11</time><span><b>Frühstück im Hotel</b><small>ohne Zeitdruck</small></span></li><li><time>10:00</time><span><b>Hortus oder Amsterdamse Bos</b><small>früh ist es am ruhigsten</small></span></li><li><time>ab 15:00</time><span><b>Prinsengracht meiden</b><small>Konzert-Crowds im Jordaan</small></span></li></ul></div></article>
              <article className="day-card sunday"><div className="day-date"><span>SO</span><strong>23</strong></div><div className="day-body"><p className="eyebrow">RENNTAG</p><h3>Sonntag mit Reserve</h3><ul><li><time>07:00</time><span><b>Frühstück & Check-out</b><small>Gepäck/Auto wie vereinbart</small></span></li><li><time>ca. 08:15</time><span><b>Zug ab Centraal</b><small>Takt etwa alle 5 Minuten</small></span></li><li><time>17:30+</time><span><b>Gold+ Fanzone Deck</b><small>danach entspannt zurück</small></span></li></ul></div></article>
            </div>
          </section>

          <section className="split-feature"><div><p className="eyebrow">SAMSTAG-SICHERHEITSNETZ</p><h2>Drei gute Rückzugsorte</h2><p>Alle drei funktionieren ohne dichtes Programm. OBA ist die beste kostenlose Regenreserve, De Nieuwe Ooster bietet am meisten Ruhe, Hortus die schönste kompakte Gartenpause.</p><button className="text-button" onClick={() => { setTab("orte"); setQuietOnly(true); }}>Auf der Karte ansehen →</button></div><div className="mini-place-list">{places.filter((place) => ["oba", "nieuwe-ooster", "hortus"].includes(place.id)).map((place) => <button key={place.id} onClick={() => setSelected(place)}><span style={{ background: categoryMeta[place.category].color }}>{categoryMeta[place.category].icon}</span><b>{place.name}<small>{place.kicker}</small></b><QuietMeter value={place.quiet} /></button>)}</div></section>
        </>}

        {tab === "orte" && <section className="map-page">
          <div className="section-heading map-title"><div><p className="eyebrow">KARTE + KURATIERTE AUSWAHL</p><h1>Gute Orte ohne Suchstress</h1></div><button className="secondary-button compact" onClick={showLocation}>⌖ Mein Standort</button></div>
          <div className="filter-panel"><div className="museum-free"><b>Museumfreier Samstag</b><span>„Ansehen“ enthält freie Außenorte. Im Haarlem-Modus filtern Essen, Café, Grün und Vintage nur die lokale Auswahl – inklusive Pommes und 90er-/Y2K-Chancen.</span></div><label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ort, Essen oder Stichwort …" aria-label="Orte durchsuchen" />{query && <button onClick={() => setQuery("")} aria-label="Suche löschen">×</button>}</label><div className="category-row"><button className={category === "alle" ? "active" : ""} onClick={() => setCategory("alle")}>Alle</button>{categoryOrder.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); if (item === "shoppen") { setMapScope("haarlem"); setQuietOnly(false); } }}><i style={{ background: categoryMeta[item].color }} />{categoryMeta[item].label}</button>)}</div><div className="filter-row"><button className={`quiet-toggle${quietOnly ? " active" : ""}`} onClick={() => setQuietOnly((value) => !value)}>◌ Ruhig ≥ 4</button><label>Sortieren <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="ruhe">nach Ruhe</option><option value="name">nach Name</option><option value="distanz" disabled={!position}>nach Distanz</option></select></label><span>{filteredPlaces.length} Orte</span></div>{locationError && <p className="form-error">{locationError}</p>}</div>
          <div className="map-layout"><div className="map-frame"><div className="map-switch"><button className={mapScope === "city" ? "active" : ""} onClick={() => { setMapScope("city"); if (category === "shoppen") setCategory("alle"); }}>Amsterdam</button><button className={mapScope === "haarlem" ? "active" : ""} onClick={() => { setMapScope("haarlem"); setCategory("alle"); setQuietOnly(false); }}>Haarlem</button><button className={mapScope === "route" ? "active" : ""} onClick={() => { setMapScope("route"); setCategory("gp"); setQuietOnly(false); }}>GP</button></div><div id="trip-map" aria-label="Karte mit Hotel, Rückzugsorten, Gastronomie, Haarlem-Auswahl und GP-Route" /><div className="map-legend"><i className="hotel-dot" /> Hotel <i className="quiet-dot" /> Ruhig <i className="green-dot" /> Grün <i className="food-dot" /> Essen <i className="cafe-dot" /> Café <i className="shop-dot" /> Vintage <i className="gp-dot" /> GP</div></div><div className="place-list">{filteredPlaces.map((place) => <article className="place-card" key={place.id}><button className="place-main" onClick={() => setSelected(place)}><div className="place-kicker"><span style={{ color: categoryMeta[place.category].color }}>{categoryMeta[place.category].icon} {categoryMeta[place.category].label}</span>{position && <em>{distanceKm(position, place).toFixed(1)} km</em>}</div><h3>{place.name}</h3><p>{place.kicker}</p><div className="place-meta"><QuietSummary value={place.quiet} /><span>{place.price}</span><span>{place.hours.split("·")[0]}</span></div></button><button className={`favorite${favorites.includes(place.id) ? " active" : ""}`} onClick={() => toggleFavorite(place.id)} aria-label={favorites.includes(place.id) ? "Aus Favoriten entfernen" : "Als Favorit speichern"}>♥</button></article>)}{!filteredPlaces.length && <div className="empty-state"><b>Nichts Passendes gefunden.</b><span>Filter lockern oder einen anderen Begriff probieren.</span></div>}</div></div>
        </section>}

        {tab === "gp" && <section className="gp-page">
          <div className="gp-hero"><div><p className="eyebrow coral">SONNTAG · 23. AUGUST 2026</p><h1>Renntag ohne Hektik</h1><p>Früher Start, Tickets griffbereit, Ohrschutz dabei – und nach dem Rennen bleibt ihr einfach noch auf dem Gold Deck.</p></div><div className="race-clock"><span>RACE START</span><strong>15:00</strong><small>72 RUNDEN · BIS CA. 17:00</small></div></div>
          <div className="circuit-info-grid">
            <article className="circuit-map-card">
              <div className="track-visual" aria-hidden="true"><span>ZANDVOORT</span><svg viewBox="0 0 320 180" role="img"><path d="M51 114c4-27 26-44 49-51 23-7 38-27 67-25 36 2 46 23 72 37 22 12 41 1 48 18 6 16-14 26-35 28-31 3-40 21-69 26-24 4-41-5-58-16-17-12-34-1-53 2-17 3-24-5-21-19Z" /><path className="start-line" d="m250 120 10 19" /></svg><small>STRECKENSILHOUETTE · SCHEMATISCH</small></div>
              <div><p className="eyebrow">OFFIZIELLER LAGEPLAN 2026</p><h2>Wo sind Gate, Tribüne und Gold+ Deck?</h2><p>Der offizielle PDF-Plan zeigt alle drei Eingänge, jede Tribüne, Fanzone und Gold+ Deck sowie Bahnhof, Erste Hilfe, Toiletten, Wasserstellen und Livescreens.</p><div className="mini-alert"><b>Das Ticket entscheidet:</b> Der richtige Eingang steht auf dem persönlichen Ticket – nicht pauschal Gate 1 ansteuern.</div><ActionLink href={circuitMapUrl} primary>Lageplan als PDF</ActionLink></div>
            </article>
            <article className="track-facts panel-card"><p className="eyebrow">CIRCUIT ZANDVOORT</p><dl><div><dt>Streckenlänge</dt><dd>4,259 km</dd></div><div><dt>Kurven</dt><dd>14</dd></div><div><dt>Renndistanz</dt><dd>306,648 km</dd></div><div><dt>Runden</dt><dd>72</dd></div></dl><ActionLink href="https://www.formula1.com/en/information/netherlands-zandvoort-circuit-zandvoort.6XdtPTIMZzx5wLKP9mm7Ev">Offizielle Streckeninfo</ActionLink></article>
          </div>

          <section className="gold-plus-panel">
            <div className="gold-plus-head"><div><p className="eyebrow">EURE TICKETKATEGORIE</p><h2>Gold+ auf einen Blick</h2></div><ActionLink href={goldPlusUrl}>Offizielle Gold+-Seite</ActionLink></div>
            <div className="gold-benefits"><div><span>01</span><b>Gold-Tribünensitz<small>Reservierter Sitzplatz in der Gold-Kategorie mit guter Streckensicht.</small></b></div><div><span>02</span><b>Gold+ Lanyard<small>Zugangspass am Renntag sichtbar und griffbereit tragen.</small></b></div><div><span>03</span><b>Deck ab 17:30<small>Exklusiver Fanzone-Deckzugang mit Blick auf die Hauptbühne.</small></b></div><div><span>04</span><b>Catering inklusive<small>Mahlzeit und eine breite Auswahl an Snacks sind enthalten.</small></b></div><div><span>05</span><b>Open Bar<small>Bier, Wein und Softdrinks; unter 18 ausschließlich alkoholfrei.</small></b></div><div><span>06</span><b>Sonntags-Show<small>Martin Garrix, Davina Michelle und Dirty Daddies.</small></b></div></div>
          </section>

          <div className="official-links"><ActionLink href="https://dutchgp.com/en/" primary>Offizielle Dutch-GP-Website</ActionLink><ActionLink href={visitorInfoUrl}>Besucherinfo & Regeln</ActionLink><ActionLink href={officialRaceUrl}>Offizieller F1-Zeitplan</ActionLink><ActionLink href="https://dutchgp.com/en/circuit-map/">Circuit-Map-Webseite</ActionLink></div>
          <div className="gp-grid"><article className="race-plan panel-card"><div className="panel-head"><p className="eyebrow">EMPFOHLENER ABLAUF</p><span>mit Puffer</span></div><ol><li><time>07:00</time><div><b>Frühstück im Café Celia</b><p>Danach auschecken; Gepäck und späte Autoabholung wie Freitag besprochen.</p></div></li><li><time>08:00</time><div><b>Zu Fuß zum Centraal</b><p>Etwa 5 Minuten vom Hotel. NS-Tickets schon auf beiden Handys oder ausgedruckt.</p></div></li><li><time>08:15</time><div><b>Direktzug nach Zandvoort</b><p>Etwa 31 Minuten, Sondertakt ungefähr alle 5 Minuten. Keinen bestimmten Zug erzwingen.</p></div></li><li><time>09:15–09:45</time><div><b>Ankunft am Circuit</b><p>Bahnhof → Eingang etwa 15 Minuten plus Crowd-Puffer. Das Gelände ist ab 08:00 offen.</p></div></li><li><time>10:30</time><div><b>F1 Academy</b><p>Porsche Supercup 11:45 · Fahrerparade 13:00 · Hymne 14:44.</p></div></li><li className="race"><time>15:00</time><div><b>Dutch Grand Prix</b><p>Geplantes Rennende gegen 17:00.</p></div></li><li className="gold"><time>17:30+</time><div><b>Gold+ Fanzone Deck</b><p>Catering, Snacks und Open Bar; für die 15-Jährige nur Softdrinks. Gute Strategie gegen den ersten Bahnhofsstau.</p></div></li><li><time>ca. 20:15</time><div><b>Rückweg nach Gefühl</b><p>Gelände bis 21:00. Live-Abfahrt in NS prüfen; auch später können Schlangen entstehen.</p></div></li></ol></article><aside className="gp-aside"><article className="ticket-card panel-card"><p className="eyebrow">NOCH ZU KAUFEN</p><h2>2× GP Dagretour</h2><p>15 Jahre = kein Railrunner. Reguläres E-Ticket kaufen und Ausweis mitnehmen.</p><ActionLink href={ticketUrl} primary>NS-Tickets kaufen</ActionLink><ActionLink href={gvbTicketsUrl}>Amsterdam-ÖPNV</ActionLink><ActionLink href={nsPlannerUrl}>Live-Fahrplan</ActionLink></article><article className="panel-card pack-card"><p className="eyebrow">IN DIE KLEINE TASCHE</p><ul className="check-list"><li>Gold+-Tickets in DutchGP-App</li><li>NS-Tickets + Ausweise</li><li>Guter Ohrschutz / Ohrstöpsel</li><li>Ponchos, keine Regenschirme</li><li>Leere Flasche, max. 0,5 l</li><li>Powerbank + Ladekabel</li><li>Sonnenbrille / Cap</li></ul></article><article className="drive-card"><b>Späte Heimfahrt</b><p>Die Fahrerin bleibt auf dem Gold Deck bei alkoholfreien Getränken. Vor der Autofahrt am Hotel noch trinken, kurz sitzen und Müdigkeit ehrlich prüfen.</p></article><article className="warning-card"><b>Wichtig am Circuit</b><p>Kein Wiedereinlass und keine Schließfächer. Eigene Speisen, Schirme, Selfiesticks und größere Kameraausrüstung sind nicht erlaubt. Bezahlt wird bargeldlos.</p></article><article className="calm-card"><b>Sensorischer Plan</b><p>Ein offizieller Ruheraum ist nicht bestätigt. Ohrschutz schon vor dem Eingang einsetzen, Randzeiten nutzen und die Erste-Hilfe-Punkte in der DutchGP-App markieren.</p></article></aside></div>
        </section>}

        {tab === "info" && <section className="info-page">
          <div className="section-heading"><div><p className="eyebrow">ALLES WICHTIGE</p><h1>Infos & Schnellzugriffe</h1></div><button className="secondary-button compact" onClick={shareApp}>↗ App teilen</button></div>
          <div className="info-grid"><article className="info-card hotel-info"><div className="info-icon">⌂</div><div><p className="eyebrow">HOTEL</p><h2>Kimpton De Witt</h2><p>Nieuwezijds Voorburgwal 5<br />1012 RC Amsterdam</p><dl><div><dt>Check-in</dt><dd>ab 15:00</dd></div><div><dt>Check-out</dt><dd>bis 12:00</dd></div><div><dt>Frühstück</dt><dd>07:00–11:00</dd></div></dl><button className="text-button" onClick={() => setModal("hotel")}>Hotel-Details & Navigation →</button></div></article><button className="info-card button-card" onClick={() => setModal("train")}><div className="info-icon red">↔</div><div><p className="eyebrow">SONNTAG</p><h2>Zug nach Zandvoort</h2><p>Ticketkauf, Richtzeiten, Live-Fahrplan und Rückweg.</p><span>Öffnen →</span></div></button><button className="info-card button-card" onClick={() => setModal("transit")}><div className="info-icon blue">▤</div><div><p className="eyebrow">AMSTERDAM</p><h2>Bus, Tram & Metro</h2><p>OVpay-Regel, 9292-Routenplaner und Ticketoptionen.</p><span>Öffnen →</span></div></button><button className="info-card button-card documents-card" onClick={() => setModal("documents")}><div className="info-icon violet">▣</div><div><p className="eyebrow">NUR AUF DEM IPHONE</p><h2>Reisedokumente</h2><p>Personalausweis und Auslandsreiseversicherung über lokale Kurzbefehle öffnen.</p><span>Dokumente öffnen →</span></div></button><button className="info-card button-card" onClick={() => setModal("install")}><div className="info-icon orange"><Image src={appIconUrl} alt="" width={43} height={43} /></div><div><p className="eyebrow">HANDY-SHORTCUT</p><h2>App installieren</h2><p>Das F1-Icon direkt auf den Startbildschirm legen.</p><span>Anleitung →</span></div></button><article className="info-card weather-card"><div className="weather-top"><div><p className="eyebrow">WETTER · STAND 20.08.</p><h2>Jacke + Poncho</h2></div><span>☂</span></div><div className="weather-days"><div><b>FR 21</b><span>20° / 12°</span><small>Schauer möglich</small></div><div><b>SA 22</b><span>19° / 12°</span><small>teils sonnig</small></div><div><b>SO 23</b><span>20° / 11°</span><small>teils sonnig</small></div></div><a href="https://www.knmi.nl/nederland-nu/weer/verwachtingen" target="_blank" rel="noreferrer">Live-Prognose prüfen ↗</a></article><article className="info-card crowd-card"><div className="info-icon amber">!</div><div><p className="eyebrow">SAMSTAG · CROWDWARNUNG</p><h2>Prinsengrachtconcert</h2><p>Rund um Prinsengracht 323 und den südlichen Jordaan wird es ab dem Nachmittag voll; Hauptprogramm abends. Für Ruhe besser OBA, Oosterdok, Bos oder den Osten wählen.</p><a href="https://prinsengrachtconcert.nl/" target="_blank" rel="noreferrer">Veranstaltungsinfo ↗</a></div></article><button className="info-card button-card emergency" onClick={() => setModal("sos")}><div className="info-icon red">+</div><div><p className="eyebrow">NOTFALL & HILFE</p><h2>SOS-Karte</h2><p>112, Bereitschaftsarzt, Polizei, Hotel und deutsches Konsulat.</p><span>Kontakte öffnen →</span></div></button></div>
        </section>}
      </div>

      <button className="hotel-fab" onClick={() => setModal("hotel")}><span>⌂</span><b>Hotel<small>Kimpton De Witt</small></b></button>
      <nav className="mobile-tabs" aria-label="Hauptnavigation">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{item.icon}</span>{item.short}</button>)}</nav>

      {selected && <Overlay title={selected.name} eyebrow={`${categoryMeta[selected.category].label} · RUHE ${selected.quiet}/5 · ${quietLabel(selected.quiet)}`} onClose={() => setSelected(null)}><p className="lead">{selected.description}</p><QuietSummary value={selected.quiet} /><dl className="detail-list"><div><dt>Adresse</dt><dd>{selected.address}</dd></div><div><dt>Zeiten</dt><dd>{selected.hours}</dd></div><div><dt>Preis</dt><dd>{selected.price}</dd></div><div><dt>Beste Zeit</dt><dd>{selected.bestTime}</dd></div>{selected.note && <div className="note-row"><dt>Hinweis</dt><dd>{selected.note}</dd></div>}</dl><div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="modal-actions"><ActionLink href={navUrl(selected, "walking")} primary>Zu Fuß</ActionLink><ActionLink href={navUrl(selected, "transit")}>ÖPNV</ActionLink><ActionLink href={selected.source}>Offizielle Info</ActionLink></div></Overlay>}

      {modal === "hotel" && <Overlay title="Kimpton De Witt" eyebrow="EURE FESTE BASIS" onClose={() => setModal(null)}><div className="hotel-banner"><span>⌂</span><div><b>Nieuwezijds Voorburgwal 5</b><small>Ca. 5 Minuten zu Fuß von Amsterdam Centraal</small></div></div><dl className="detail-list"><div><dt>Check-in</dt><dd>ab 15:00 · Mindestalter 18</dd></div><div><dt>Check-out</dt><dd>bis 12:00</dd></div><div><dt>Frühstück</dt><dd>07:00–11:00 im Café Celia</dd></div><div><dt>Rezeption</dt><dd><a href="tel:+31206200500">+31 20 620 0500</a></dd></div><div><dt>Sonntag</dt><dd>Vorab klären: Gepäckaufbewahrung und Autozugang bis zur späten Rückkehr.</dd></div></dl><div className="modal-actions"><ActionLink href={navUrl(places[0], "walking")} primary>Zu Fuß</ActionLink><ActionLink href={navUrl(places[0], "transit")}>ÖPNV</ActionLink><ActionLink href={navUrl(places[0], "driving")}>Auto</ActionLink><ActionLink href="https://www.ihg.com/kimptonhotels/hotels/us/en/amsterdam/amsnl/hoteldetail">Hotel öffnen</ActionLink></div></Overlay>}

      {modal === "train" && <Overlay title="Amsterdam ↔ Zandvoort" eyebrow="ZUGPLAN · SONNTAG" onClose={() => setModal(null)}><div className="train-strip"><div><span>08:15</span><b>Amsterdam C.</b></div><i /><div><span>≈ 08:46</span><b>Zandvoort</b></div><i className="walk" /><div><span>≈ 09:15</span><b>Circuit</b></div></div><p className="lead">Am GP-Wochenende fahren etwa 12 Züge pro Stunde – ungefähr alle fünf Minuten. Die Zeiten sind Richtwerte: immer kurz vorher in NS prüfen.</p><div className="callout"><b>Ticketempfehlung</b><p>2× Dutch Grand Prix Dagretour vorab kaufen. Die 15-Jährige ist zu alt für den Railrunner und braucht ohne vorhandenes niederländisches NS-Jugendabo ein reguläres Ticket.</p></div><dl className="detail-list"><div><dt>Fahrzeit</dt><dd>ca. 31 Minuten direkt</dd></div><div><dt>Zum Circuit</dt><dd>ca. 15 Minuten zu Fuß + Crowd-Puffer</dd></div><div><dt>Rückfahrt</dt><dd>Nach Gold+ gegen 20:15 live prüfen. Wartezeit am Bahnhof bis zu 60 Minuten einplanen.</dd></div><div><dt>Am Gate</dt><dd>E-Ticket in NS-App oder ausgedruckt; Ausweis mitnehmen.</dd></div></dl><div className="modal-actions"><ActionLink href={ticketUrl} primary>2 Tickets kaufen</ActionLink><ActionLink href={gvbTicketsUrl}>GVB-Tickets</ActionLink><ActionLink href={nsPlannerUrl}>NS-Fahrplan</ActionLink><ActionLink href="https://dutchgp.com/en/vervoer/train/">GP-Zuginfo</ActionLink></div></Overlay>}

      {modal === "transit" && <Overlay title="ÖPNV in Amsterdam" eyebrow="BUS · TRAM · METRO" onClose={() => setModal(null)}><p className="lead">Für zwei Personen ist OVpay meist am einfachsten: jeweils mit der eigenen kontaktlosen Karte oder dem eigenen Handy ein- und mit demselben Medium wieder auschecken.</p><div className="transit-tip"><b>Wichtig für die Tochter</b><p>Sie braucht ein eigenes Zahlungsmittel. Eine Karte kann nicht gleichzeitig für zwei Reisende genutzt werden.</p></div><dl className="detail-list"><div><dt>OVpay</dt><dd>Ein-/Auschecken direkt mit Bankkarte oder Gerät; GVB-Tagesdeckel derzeit €10.</dd></div><div><dt>GVB 1 Stunde</dt><dd>€3,40; lohnt nur bei einer kurzen Einzelfahrt.</dd></div><div><dt>Busfahrplan</dt><dd>Keine statischen Linien merken – Start, Ziel und Uhrzeit live in 9292 eingeben.</dd></div><div><dt>Zum Amsterdamse Bos</dt><dd>9292-Ziel „Amsterdamse Bos / De Boswinkel“; Verbindung am Samstag live prüfen.</dd></div></dl><div className="modal-actions"><ActionLink href={transitPlannerUrl} primary>Route in 9292</ActionLink><ActionLink href="https://www.gvb.nl/en">GVB öffnen</ActionLink></div></Overlay>}

      {modal === "install" && <Overlay title="Als App installieren" eyebrow="F1-SHORTCUT" onClose={() => setModal(null)}><div className="install-preview"><Image src={appIconUrl} alt="NL F1 Weekend App-Icon" width={66} height={66} /><div><b>NL F1 Weekend</b><small>Direkt vom Startbildschirm öffnen</small></div></div><div className="install-steps"><div><span>iPhone / iPad</span><ol><li>Diese Seite in Safari öffnen.</li><li>Unten auf „Teilen“ tippen.</li><li>„Zum Home-Bildschirm“ wählen.</li><li>Mit „Hinzufügen“ bestätigen.</li></ol></div><div><span>Android / Chrome</span><ol><li>Menü ⋮ oben rechts öffnen.</li><li>„App installieren“ oder „Zum Startbildschirm“ wählen.</li><li>Installation bestätigen.</li></ol></div></div><p className="small-note">Plan, Adressen und Notfallnummern bleiben nach dem ersten Öffnen grundsätzlich verfügbar. Live-Karte, Wetter und Fahrpläne brauchen Internet.</p></Overlay>}

      {modal === "documents" && <Overlay title="Lokale Reisedokumente" eyebrow="IPHONE-KURZBEFEHLE" onClose={() => setModal(null)}><div className="privacy-banner"><span>✓</span><div><b>Keine Datei wird hochgeladen</b><small>Die App startet nur den passenden Kurzbefehl. Bilder und PDFs bleiben lokal in „Dateien“ und gehören nicht zum App- oder GitHub-Code.</small></div></div><div className="document-launchers"><a href={shortcutUrl("Personalausweis")}><span>▣</span><b>Personalausweis<small>Feste lokale Datei öffnen</small></b><em>Öffnen</em></a><a href={shortcutUrl("Auslandsreiseversicherung")}><span>✚</span><b>Auslandsreiseversicherung<small>Feste lokale Datei öffnen</small></b><em>Öffnen</em></a><a href={shortcutUrl("Parkticket Oosterdok")}><span>Ⓟ</span><b>Parkticket Oosterdok<small>Ticket als Bild oder PDF öffnen</small></b><em>Öffnen</em></a><a href={shortcutUrl("Freie lokale Datei")}><span>＋</span><b>Freie lokale Datei<small>Beliebiges Bild oder PDF auswählen</small></b><em>Auswählen</em></a></div><div className="shortcut-setup"><p className="eyebrow">EINMAL AUF JEDEM IPHONE EINRICHTEN</p><ol><li>Ausweis, Versicherung und Parkticket in „Dateien“ ablegen – für sicher offline verfügbare Dateien unter <b>Auf meinem iPhone</b>.</li><li>In „Kurzbefehle“ vier Kurzbefehle mit exakt diesen Namen anlegen: <b>Personalausweis</b>, <b>Auslandsreiseversicherung</b>, <b>Parkticket Oosterdok</b> und <b>Freie lokale Datei</b>.</li><li>Bei den ersten drei jeweils die feste Datei mit der Aktion <b>Datei</b> laden und danach mit <b>Übersicht</b> anzeigen.</li><li>Beim freien Kurzbefehl die Aktion <b>Datei auswählen</b> und danach <b>Übersicht</b> einsetzen. So lässt sich bei jedem Start ein anderes Bild oder PDF öffnen.</li><li>Alle vier einmal direkt in „Kurzbefehle“ testen; danach starten die App-Buttons den jeweils gleichnamigen Kurzbefehl.</li></ol><div className="shortcut-actions"><a href="shortcuts://create-shortcut">Neuen Kurzbefehl anlegen</a><a href="shortcuts://">Kurzbefehle öffnen</a></div></div><p className="small-note">Der Klick öffnet die Apple-App „Kurzbefehle“ und dort die Datei in „Übersicht“. Falls iOS beim ersten Start nach Zugriff auf „Dateien“ fragt, muss dieser einmal lokal bestätigt werden.</p></Overlay>}

      {modal === "sos" && <Overlay title="Notfall & Hilfe" eyebrow="IM ERNSTFALL" onClose={() => setModal(null)}><a className="emergency-call" href="tel:112"><span>112</span><b>Akuter Notfall<small>Polizei · Feuerwehr · Rettungsdienst</small></b></a><div className="contact-list"><a href="tel:+31880030600"><span>Ärztlicher Bereitschaftsdienst</span><b>+31 88 00 30 600</b><small>Wochenende 24 h · vor Besuch anrufen</small></a><a href="tel:09008844"><span>Polizei · kein Notfall</span><b>0900 8844</b><small>Aus ausländischem Netz: +31 34 357 8844</small></a><a href="tel:+31206200500"><span>Kimpton De Witt</span><b>+31 20 620 0500</b><small>Rezeption rund um die Uhr</small></a><a href="tel:+31205747700"><span>Deutsches Generalkonsulat</span><b>+31 20 574 77 00</b><small>Notfall außerhalb Bürozeit: +31 6 22 45 98 41</small></a></div><div className="callout"><b>Am Circuit</b><p>Erste-Hilfe-Punkte stehen in der DutchGP-App und auf der Gelände-Karte. Bei Überlastung Personal direkt ansprechen; wegen „kein Wiedereinlass“ nicht einfach das Gelände verlassen.</p></div></Overlay>}
    </main>
  );
}
