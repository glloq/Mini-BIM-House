import { describe, expect, it } from 'vitest';

import {
  EDITOR_TOOLS,
  populatedToolGroups,
  toolAtLevel,
  toolDefinition,
  toolsInGroup,
} from './tool-registry.js';

/**
 * What the redesign asks of the tools, checked on the registry.
 *
 * The components themselves are rendered by the end-to-end journeys; what can
 * be checked here is the shape of what they are given.
 */
describe('the tools of the context panel', () => {
  it('leaves no tool out of a group the panel shows', () => {
    const shown = new Set(
      populatedToolGroups().flatMap((group) =>
        toolsInGroup(group).map(({ id }) => id),
      ),
    );
    for (const tool of EDITOR_TOOLS) expect(shown.has(tool.id)).toBe(true);
  });

  it('keeps every group short enough to read without searching', () => {
    // Three densities and no more; past about ten entries a list needs a
    // search, and a tool group that needs a search is a group to split.
    for (const group of populatedToolGroups())
      expect(toolsInGroup(group).length).toBeLessThanOrEqual(10);
  });

  it('shows the common tools and folds the rest away, for everyone', () => {
    // No « simple » and « expert » modes: one screen, with the advanced tools
    // one disclosure away rather than in another product.
    for (const group of populatedToolGroups()) {
      const tools = toolsInGroup(group);
      const common = tools.filter((tool) => toolAtLevel(tool, 'DESIGN'));
      expect(
        common.length +
          tools.filter((tool) => !toolAtLevel(tool, 'DESIGN')).length,
      ).toBe(tools.length);
      // A group whose every tool is advanced would show as an empty group with
      // a disclosure under it.
      expect(common.length).toBeGreaterThan(0);
    }
  });

  it('offers selection as the resting state rather than as a tool to pick', () => {
    const select = toolDefinition('SELECT');
    expect(select.requiredPoints).toBe(0);
    expect(toolAtLevel(select, 'QUICK')).toBe(true);
  });
});
