type TopologyTransform = {
  scale: [number, number];
  translate: [number, number];
};

type TopologyGeometry = {
  type: "Polygon" | "MultiPolygon";
  id?: string;
  arcs: number[][] | number[][][];
  properties?: { name?: string };
};

type Topology = {
  type: "Topology";
  transform: TopologyTransform;
  arcs: number[][][];
  objects: {
    counties: { geometries: TopologyGeometry[] };
    states: { geometries: TopologyGeometry[] };
    nation?: { geometries: TopologyGeometry[] };
  };
};

export type CountyMapPath = {
  id: string;
  d: string;
  selected: boolean;
};

const atlasUrl = "/data/counties-albers-10m.json";
const viewWidth = 320;
const viewHeight = 280;
const usViewWidth = 400;
const usViewHeight = 250;
const viewPadding = 10;

let atlasPromise: Promise<Topology> | undefined;

function loadAtlas() {
  atlasPromise ??= fetch(atlasUrl).then(async (response) => {
    if (!response.ok) throw new Error("County map atlas is unavailable.");
    return (await response.json()) as Topology;
  });
  return atlasPromise;
}

export async function loadCountyStateMap(countyFips: string) {
  const atlas = await loadAtlas();
  const stateFips = countyFips.slice(0, 2).padStart(2, "0");
  const selectedFips = countyFips.padStart(5, "0");
  const counties = atlas.objects.counties.geometries.filter((geometry) =>
    String(geometry.id || "").padStart(5, "0").startsWith(stateFips),
  );
  const state = atlas.objects.states.geometries.find((geometry) => String(geometry.id || "").padStart(2, "0") === stateFips);
  const countyRings = counties.map((geometry) => ({
    id: String(geometry.id || "").padStart(5, "0"),
    rings: geometryRings(atlas, geometry),
  }));
  const points = countyRings.flatMap((county) => county.rings.flat());
  if (!points.length) return { counties: [] as CountyMapPath[], outline: "" };

  const project = createProjector(points, viewWidth, viewHeight);
  return {
    counties: countyRings.map((county) => ({
      id: county.id,
      d: ringsToPath(county.rings, project),
      selected: county.id === selectedFips,
    })),
    outline: state ? ringsToPath(geometryRings(atlas, state), project) : "",
  };
}

export async function loadUnitedStatesMap(selectedStateName?: string) {
  const atlas = await loadAtlas();
  const states = atlas.objects.states.geometries.map((geometry) => ({
    id: String(geometry.id || "").padStart(2, "0"),
    name: geometry.properties?.name || String(geometry.id || ""),
    rings: geometryRings(atlas, geometry),
  }));
  const points = states.flatMap((state) => state.rings.flat());
  if (!points.length) return { states: [] as CountyMapPath[], outline: "" };

  const project = createProjector(points, usViewWidth, usViewHeight);
  const nation = atlas.objects.nation?.geometries[0];
  return {
    states: states.map((state) => ({
      id: state.id,
      d: ringsToPath(state.rings, project),
      selected: Boolean(selectedStateName && state.name === selectedStateName),
    })),
    outline: nation ? ringsToPath(geometryRings(atlas, nation), project) : "",
  };
}

function geometryRings(atlas: Topology, geometry: TopologyGeometry) {
  if (geometry.type === "Polygon") {
    return (geometry.arcs as number[][]).map((ring) => decodeRing(atlas, ring));
  }
  return (geometry.arcs as number[][][]).flatMap((polygon) => polygon.map((ring) => decodeRing(atlas, ring)));
}

function decodeRing(atlas: Topology, ring: number[]) {
  const points: Array<[number, number]> = [];
  for (const arcIndex of ring) {
    const decoded = decodeArc(atlas, arcIndex);
    if (points.length) decoded.shift();
    points.push(...decoded);
  }
  return points;
}

function decodeArc(atlas: Topology, index: number) {
  const { scale, translate } = atlas.transform;
  const raw = atlas.arcs[index < 0 ? ~index : index] || [];
  let x = 0;
  let y = 0;
  const points = raw.map(([dx = 0, dy = 0]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
  });
  return index < 0 ? points.reverse() : points;
}

function createProjector(points: Array<[number, number]>, width: number, height: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - viewPadding * 2) / spanX, (height - viewPadding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return ([x, y]: [number, number]) => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale] as [number, number];
}

function ringsToPath(rings: Array<Array<[number, number]>>, project: (point: [number, number]) => [number, number]) {
  return rings
    .map((ring) => {
      if (!ring.length) return "";
      return `${ring
        .map((point, index) => {
          const [x, y] = project(point);
          return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join("")}Z`;
    })
    .join("");
}

export const countyMapViewBox = `0 0 ${viewWidth} ${viewHeight}`;
export const unitedStatesMapViewBox = `0 0 ${usViewWidth} ${usViewHeight}`;
