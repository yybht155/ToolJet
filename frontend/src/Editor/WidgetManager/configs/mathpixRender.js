export const mathpixRenderConfig = {
  name: 'MathpixRender',
  displayName: 'Mathpix Render',
  description: 'Mathpix Render',
  component: 'MathpixRender',
  properties: {
    data: { type: 'code', displayName: 'Data', validation: { schema: { type: 'string' }, defaultValue: '' } },
  },
  defaultSize: {
    width: 20,
    height: 140,
  },
  others: {
    showOnDesktop: { type: 'toggle', displayName: 'Show on desktop' },
    showOnMobile: { type: 'toggle', displayName: 'Show on mobile' },
  },
  events: {},
  styles: {
    visibility: {
      type: 'toggle',
      displayName: 'Visibility',
      validation: { schema: { type: 'boolean' }, defaultValue: true },
    },
  },
  exposedVariables: {
    data: { value: `\\(ax^2 + bx + c = 0\\)` },
  },
  actions: [
    {
      handle: 'setData',
      displayName: 'Set data',
      params: [{ handle: 'data', displayName: 'data', defaultValue: 'New data' }],
    },
    {
      handle: 'clear',
      displayName: 'Clear',
    },
  ],
  definition: {
    others: {
      showOnDesktop: { value: '{{true}}' },
      showOnMobile: { value: '{{false}}' },
    },
    properties: {
      visible: { value: '{{true}}' },
      data: {
        value: `\\(ax^2 + bx + c = 0\\)`,
      }
    },
    events: [],
    styles: {
      visibility: { value: '{{true}}' },
    },
  },
};
