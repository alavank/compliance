export type OrganizationNode = {
  id: string;
  name: string;
  type?: string | null;
  label?: string | null;
  parent_id?: string | null;
};

export function buildOrganizationPathMap(items: OrganizationNode[]) {
  const mapById = new Map<string, OrganizationNode>();
  const pathMap: Record<string, string> = {};

  items.forEach((item) => {
    mapById.set(item.id, item);
  });

  const buildPath = (item: OrganizationNode | undefined): string => {
    if (!item) return '';
    if (pathMap[item.id]) return pathMap[item.id];

    const parent = item.parent_id ? mapById.get(item.parent_id) : undefined;
    const current = item.name || 'Sem nome';
    const path = parent ? buildPath(parent) + ' / ' + current : current;
    pathMap[item.id] = path;
    return path;
  };

  items.forEach((item) => {
    buildPath(item);
  });

  return pathMap;
}
