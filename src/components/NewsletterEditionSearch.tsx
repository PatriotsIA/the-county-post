import { useId, useMemo, useState } from 'react';
import { searchCounties, searchStates } from '../data/place-search';
import { nationalEdition, type EditionChoice } from '../data/morning-post';

export function NewsletterEditionSearch({ selected, onChange }: { selected?: EditionChoice; onChange: (choice?: EditionChoice) => void }) {
  const id = useId();
  const [query, setQuery] = useState(selected?.label || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const choices = useMemo(() => {
    const value = query.trim();
    if (!value) return [nationalEdition];
    const national = /^(national|home|united states|usa?)( edition)?$/i.test(value) || 'national edition'.includes(value.toLowerCase());
    return [
      ...(national ? [nationalEdition] : []),
      ...searchStates(value.replace(/ edition$/i, '')).slice(0, 3).map(state => ({ label: `${state.name} edition`, edition: { level: 'state' as const, state: state.slug } })),
      ...searchCounties(value).slice(0, 8).map(county => ({ label: `${county.displayName}, ${county.state.name}`, edition: { level: 'county' as const, state: county.state.slug, county: county.slug } })),
    ];
  }, [query]);
  function choose(choice: EditionChoice) { setQuery(choice.label); onChange(choice); setOpen(false); setActive(-1); }
  return <div className="newsletter-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>Your edition</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      autoComplete="off" placeholder="Search county, state, or national" value={query} maxLength={120} required
      onFocus={event => { setOpen(true); event.currentTarget.select(); }}
      onChange={event => { setQuery(event.target.value); onChange(undefined); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          const next = event.key === 'ArrowDown' ? Math.min(active + 1, choices.length - 1) : Math.max(active - 1, 0);
          setActive(choices.length ? next : -1);
          document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' });
        }
        if (event.key === 'Enter' && open && choices[active]) { event.preventDefault(); choose(choices[active]); }
      }} />
    {open ? <div className="newsletter-search-popover">
      <ul id={`${id}-results`} role="listbox" aria-label="Matching editions">
        {choices.map((choice, index) => <li key={choice.label} role="option" id={`${id}-option-${index}`} aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(choice)}>
          <span>{choice.label}</span><small>{choice.edition.level === 'county' ? 'County' : choice.edition.level === 'state' ? 'Statewide' : 'Across the U.S.'}</small>
        </li>)}
      </ul>
      <p role="status">{!query.trim() ? 'Type a county or state to find your local edition.' : choices.length ? 'Choose an edition. Add a state to narrow your county search.' : 'No matching editions. Try a county name and state, such as Potter, TX.'}</p>
    </div> : null}
  </div>;
}
