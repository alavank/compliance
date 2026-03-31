export type OrgNode = {
  id: string;
  name: string;
  type?: string;
  label?: string;
  parent_id?: string | null;
  children?: OrgNode[];
};

export type FlatOrgNode = OrgNode & {
  depth: number;
  path: string;
};

export function flattenOrgTree(tree: OrgNode[], depth = 0, ancestors: string[] = []): FlatOrgNode[] {
  return tree.flatMap((node) => {
    const path = [...ancestors, node.name].filter(Boolean).join(' / ');
    const current: FlatOrgNode = { ...node, depth, path };
    return [current, ...flattenOrgTree(node.children || [], depth + 1, [...ancestors, node.name])];
  });
}

export function buildOrgPathMap(tree: OrgNode[]) {
  return flattenOrgTree(tree).reduce<Record<string, string>>((acc, node) => {
    acc[node.id] = node.path;
    return acc;
  }, {});
}
