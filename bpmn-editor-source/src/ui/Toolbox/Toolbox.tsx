import { useMemo, useState } from "react";
import { ShapeRegistry } from "../../core/shapes/ShapeRegistry";
import type { ShapeDefinition } from "../../core/shapes/types";
import { ToolboxIcon } from "./ToolboxIcon";
import { useFavoritesStore } from "./favoritesStore";

const FAVORITES_DRAWING_TYPE = "★ Favoriten";

interface CategoryGroup {
  category: string;
  defs: ShapeDefinition[];
}

interface DrawingTypeGroup {
  drawingType: string;
  categories: CategoryGroup[];
}

/** Baut die dreistufige Hierarchie Zeichnungstyp → Kategorie → Element aus der Registry. */
function buildHierarchy(favoriteTypes: Set<string>): DrawingTypeGroup[] {
  const byDrawingType = new Map<string, Map<string, ShapeDefinition[]>>();

  for (const def of ShapeRegistry.getAll()) {
    if (!byDrawingType.has(def.drawingType)) byDrawingType.set(def.drawingType, new Map());
    const byCategory = byDrawingType.get(def.drawingType)!;
    if (!byCategory.has(def.category)) byCategory.set(def.category, []);
    byCategory.get(def.category)!.push(def);
  }

  const groups: DrawingTypeGroup[] = Array.from(byDrawingType.entries())
    .map(([drawingType, byCategory]) => ({
      drawingType,
      categories: Array.from(byCategory.entries())
        .map(([category, defs]) => ({ category, defs }))
        .sort((a, b) => a.category.localeCompare(b.category, "de")),
    }))
    // "Favoriten" immer zuerst, alle übrigen Zeichnungstypen alphabetisch danach.
    .sort((a, b) => a.drawingType.localeCompare(b.drawingType, "de"));

  // Favoriten-Zeichnungstyp: enthält Kopien aller favorisierten Elemente aus
  // allen anderen Zeichnungstypen/Kategorien, in einer einzigen flachen
  // Kategorie zusammengefasst (Herkunfts-Kategorie ist hier nicht relevant).
  const favoriteDefs = ShapeRegistry.getAll().filter((def) => favoriteTypes.has(def.type));
  if (favoriteDefs.length > 0) {
    groups.unshift({
      drawingType: FAVORITES_DRAWING_TYPE,
      categories: [{ category: "Favoriten", defs: favoriteDefs }],
    });
  }

  return groups;
}

export function Toolbox() {
  const [query, setQuery] = useState("");
  const favoriteTypes = useFavoritesStore((s) => s.favoriteTypes);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const hierarchy = useMemo(() => buildHierarchy(favoriteTypes), [favoriteTypes]);

  // Auf-/Zuklapp-Zustand: alle Zeichnungstypen starten aufgeklappt (damit
  // ihre Kategorien sichtbar sind), aber auf Kategorie-Ebene ist nur die
  // jeweils erste Kategorie (z.B. "Aktivitäten" bei BPMN 2.0, da Kategorien
  // alphabetisch sortiert vorliegen) aufgeklappt bis auf Elementebene - alle
  // weiteren Kategorien sind sichtbar, aber zugeklappt. Kein Persistieren
  // über Neustarts hinweg gewünscht, reiner In-Memory-State pro Sitzung.
  const [collapsedDrawingTypes, setCollapsedDrawingTypes] = useState<Set<string>>(() => new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const keys: string[] = [];
    for (const g of hierarchy) {
      g.categories.slice(1).forEach((c) => keys.push(`${g.drawingType}::${c.category}`));
    }
    return new Set(keys);
  });

  const toggleDrawingType = (drawingType: string) => {
    setCollapsedDrawingTypes((prev) => {
      const next = new Set(prev);
      if (next.has(drawingType)) next.delete(drawingType);
      else next.add(drawingType);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, shapeType: string) => {
    e.dataTransfer.setData("application/shape-type", shapeType);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Filtert auf allen drei Ebenen: ein Treffer auf Zeichnungstyp- oder
  // Kategorie-Name lässt die komplette Untergruppe sichtbar, sonst wird
  // pro Element nach dem Label gefiltert.
  const filteredHierarchy = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return hierarchy;

    const result: DrawingTypeGroup[] = [];
    for (const group of hierarchy) {
      const drawingTypeMatches = group.drawingType.toLowerCase().includes(trimmed);
      const matchingCategories: CategoryGroup[] = [];
      for (const cat of group.categories) {
        const categoryMatches = drawingTypeMatches || cat.category.toLowerCase().includes(trimmed);
        const defs = categoryMatches ? cat.defs : cat.defs.filter((d) => d.label.toLowerCase().includes(trimmed));
        if (defs.length > 0) matchingCategories.push({ category: cat.category, defs });
      }
      if (matchingCategories.length > 0) result.push({ drawingType: group.drawingType, categories: matchingCategories });
    }
    return result;
  }, [hierarchy, query]);

  const hasResults = filteredHierarchy.length > 0;
  // Während einer aktiven Suche werden Klapp-Zustände ignoriert und alle
  // Treffer angezeigt - sonst könnten zugeklappte Gruppen die Ergebnisse
  // verstecken und die Suche würde scheinbar "nichts finden".
  const isSearching = query.trim().length > 0;

  return (
    <div className="toolbox">
      <div className="toolbox-search">
        <input
          type="text"
          placeholder="Element, Gruppe oder Zeichnungstyp suchen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="toolbox-search-clear" onClick={() => setQuery("")} title="Suche leeren">
            ×
          </button>
        )}
      </div>

      {!hasResults && <p className="toolbox-no-results">Keine Treffer für „{query}“</p>}

      {filteredHierarchy.map((group) => {
        const isFavoritesGroup = group.drawingType === FAVORITES_DRAWING_TYPE;
        const isDrawingTypeCollapsed = !isSearching && collapsedDrawingTypes.has(group.drawingType);
        return (
          <div key={group.drawingType} className="toolbox-drawing-type">
            <button
              className="toolbox-drawing-type-header"
              onClick={() => toggleDrawingType(group.drawingType)}
              aria-expanded={!isDrawingTypeCollapsed}
            >
              <span className={isDrawingTypeCollapsed ? "toolbox-chevron toolbox-chevron--collapsed" : "toolbox-chevron"}>
                ▾
              </span>
              <span className={isFavoritesGroup ? "toolbox-drawing-type-title toolbox-drawing-type-title--favorites" : "toolbox-drawing-type-title"}>
                {group.drawingType}
              </span>
            </button>

            {!isDrawingTypeCollapsed &&
              group.categories.map((cat) => {
                const catKey = `${group.drawingType}::${cat.category}`;
                const isCategoryCollapsed = !isSearching && collapsedCategories.has(catKey);
                // Bei nur einer Kategorie (z.B. "Favoriten" selbst) lohnt sich
                // kein zusätzlicher, redundanter Klapp-Header.
                const showCategoryHeader = !(isFavoritesGroup && group.categories.length === 1);
                return (
                  <div key={catKey} className="toolbox-category">
                    {showCategoryHeader && (
                      <button
                        className="toolbox-category-header"
                        onClick={() => toggleCategory(catKey)}
                        aria-expanded={!isCategoryCollapsed}
                      >
                        <span className={isCategoryCollapsed ? "toolbox-chevron toolbox-chevron--collapsed" : "toolbox-chevron"}>
                          ▾
                        </span>
                        <span>{cat.category}</span>
                      </button>
                    )}
                    {!isCategoryCollapsed && (
                      <div className="toolbox-items">
                        {cat.defs.map((def) => {
                          const isFav = favoriteTypes.has(def.type);
                          return (
                            <div
                              key={`${catKey}:${def.type}`}
                              className="toolbox-item"
                              draggable
                              onDragStart={(e) => handleDragStart(e, def.type)}
                              title={def.label}
                            >
                              <ToolboxIcon shapeType={def.type} />
                              <span>{def.label}</span>
                              <button
                                className={isFav ? "toolbox-favorite-star toolbox-favorite-star--active" : "toolbox-favorite-star"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(def.type);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                              >
                                {isFav ? "★" : "☆"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
