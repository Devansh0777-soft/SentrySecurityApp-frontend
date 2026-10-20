import React from 'react';
import ReactTestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native';

import ClientCoverageRequests from '../src/features/client/components/ClientCoverageRequests';
import { clientService } from '../src/services/clientService';
import { appAlert } from '../src/services/alertService';
import i18n from '../src/localization';

jest.mock('../src/services/clientService', () => ({
  clientService: {
    getCoverageRequests: jest.fn(() => Promise.resolve([])),
    getAvailableAgencies: jest.fn(() => Promise.resolve([])),
    getAgencyDetails: jest.fn(() =>
      Promise.resolve({
        id: 7,
        agency_name: 'Sentinel Security',
        business_type: 'Security Agency',
        office_address: '1 Main Street',
        city: 'Ludhiana',
        district: 'Ludhiana',
        state: 'Punjab',
        pincode: '141001',
      }),
    ),
    createCoverageRequest: jest.fn(() => Promise.resolve({ id: 1 })),
  },
}));

jest.mock('../src/services/indiaLocationService', () => ({
  indiaLocationService: {
    getStates: jest.fn(() =>
      Promise.resolve([
        { name: 'Punjab', slug: 'punjab' },
        { name: 'Haryana', slug: 'haryana' },
      ]),
    ),
    getDistricts: jest.fn(() =>
      Promise.resolve([
        { name: 'Ludhiana', slug: 'ludhiana' },
        { name: 'Amritsar', slug: 'amritsar' },
      ]),
    ),
    getCities: jest.fn(() =>
      Promise.resolve([
        { name: 'Ludhiana City', slug: 'ludhiana-city' },
        { name: 'Khanna', slug: 'khanna' },
      ]),
    ),
  },
}));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const AGENT = {
  id: 7,
  agency_name: 'Sentinel Security',
  business_type: 'Security Agency',
  city: 'Ludhiana',
  district: 'Ludhiana',
  state: 'Punjab',
};

const createMock = clientService.createCoverageRequest as jest.Mock;
const agenciesMock = clientService.getAvailableAgencies as jest.Mock;

/** Renders the form and flushes the mount effects (requests + states load). */
const renderForm = async (): Promise<Renderer> => {
  let renderer!: Renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <ClientCoverageRequests />
      </SafeAreaProvider>,
    );
  });
  return renderer;
};

const texts = (root: ReactTestInstance, match: string) =>
  root.findAll(
    node =>
      node.type === Text &&
      typeof node.props.children === 'string' &&
      node.props.children.includes(match),
  );

const hasText = (root: ReactTestInstance, match: string) =>
  texts(root, match).length > 0;

/** Finds a TextInput by its placeholder and types into it. */
const typeInto = async (
  renderer: Renderer,
  placeholder: string,
  value: string,
) => {
  const input = renderer.root
    .findAllByType(TextInput)
    .find(node => node.props.placeholder === placeholder);
  if (!input) throw new Error(`No input with placeholder ${placeholder}`);
  await act(async () => {
    input.props.onChangeText(value);
    input.props.onBlur?.();
  });
};

/**
 * Finds the nearest ancestor that owns an `onPress` handler — ScalePressable
 * renders an Animated Pressable, so the handler lives on the host node.
 */
const pressableFor = (node: ReactTestInstance): ReactTestInstance => {
  let current: ReactTestInstance | null = node;
  while (current && !current.props.onPress) {
    current = current.parent;
  }
  if (!current) throw new Error('No pressable ancestor found');
  return current;
};

/** Presses the pressable that contains the first Text matching `match`. */
const pressText = async (renderer: Renderer, match: string) => {
  const node = texts(renderer.root, match)[0];
  if (!node) throw new Error(`No text matching ${match}`);
  await act(async () => {
    pressableFor(node).props.onPress();
  });
};

/** Opens a location dropdown (they show '—' when empty) and picks an option. */
const pickLocation = async (
  renderer: Renderer,
  dropdownIndex: number,
  option: string,
) => {
  const placeholders = renderer.root.findAll(
    node => node.type === Text && node.props.children === '—',
  );
  const target = placeholders[dropdownIndex];
  if (!target) throw new Error('No empty dropdown found');
  await act(async () => {
    pressableFor(target).props.onPress();
  });
  await pressText(renderer, option);
};

/** Opens the dropdown that belongs to the given field label. */
const openDropdown = async (renderer: Renderer, label: string) => {
  // The label renders as [label, <Text> *</Text>], so match on the first child.
  const labelNode = renderer.root.find(
    node =>
      node.type === Text &&
      Array.isArray(node.props.children) &&
      node.props.children[0] === label,
  );
  if (!labelNode) throw new Error(`No dropdown label matching ${label}`);
  const container = labelNode.parent as ReactTestInstance;
  const pressable = container.find(
    node => !!node.props.onPress && node.type !== Text,
  );
  await act(async () => {
    pressable.props.onPress();
  });
};

/** Opens the agency details modal for the listed agency and confirms it. */
const selectAgency = async (renderer: Renderer) => {
  await pressText(renderer, AGENT.agency_name);
  await act(async () => {}); // let getAgencyDetails resolve
  await pressText(renderer, i18n.t('coverageRequest.selectThisAgency'));
};

const fillEverythingExceptAgency = async (renderer: Renderer) => {
  await typeInto(
    renderer,
    i18n.t('coverageRequest.eventPlaceholder'),
    'Diwali Night Event',
  );
  await pickLocation(renderer, 0, 'Punjab');
  await pickLocation(renderer, 0, 'Ludhiana');
  await pickLocation(renderer, 0, 'Ludhiana City');
  await typeInto(
    renderer,
    i18n.t('coverageRequest.sitePlaceholder'),
    'East Gate',
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  appAlert.dismiss();
  agenciesMock.mockResolvedValue([]);
});

describe('ClientCoverageRequests form validation', () => {
  it('blocks an empty submit with a per-field error under each invalid control', async () => {
    const renderer = await renderForm();
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(createMock).not.toHaveBeenCalled();
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.eventNameRequired')),
    ).toBe(true);
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.stateRequired')),
    ).toBe(true);
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.districtRequired')),
    ).toBe(true);
    expect(hasText(renderer.root, i18n.t('coverageRequest.cityRequired'))).toBe(
      true,
    );
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.siteLocationRequired')),
    ).toBe(true);
  });

  it('marks every required label with a red asterisk', async () => {
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    // The agency section only renders once a district is chosen.
    await pickLocation(renderer, 0, 'Punjab');
    await pickLocation(renderer, 0, 'Ludhiana');

    const asterisks = renderer.root.findAll(
      node =>
        node.type === Text &&
        typeof node.props.children === 'string' &&
        node.props.children.trim() === '*',
    );
    // Event name, State, District, City, Agency section, Site location, Guards.
    expect(asterisks.length).toBe(7);
  });

  it('blocks submission and shows the inline agency error when no agencies could be loaded', async () => {
    agenciesMock.mockResolvedValue([]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(createMock).not.toHaveBeenCalled();
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.agencyRequired')),
    ).toBe(true);
  });

  it('blocks submission with the agency error when agencies are listed but none selected', async () => {
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(createMock).not.toHaveBeenCalled();
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.agencyRequired')),
    ).toBe(true);
  });
});

describe('ClientCoverageRequests submission', () => {
  it('submits with the selected agency ID once every required field is valid', async () => {
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    await selectAgency(renderer);
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'Diwali Night Event',
        state: 'Punjab',
        district: 'Ludhiana',
        city: 'Ludhiana City',
        siteLocation: 'East Gate',
        guardsNeeded: 1,
        agencyId: 7,
      }),
    );
    // Success is confirmed only after the backend accepts the request.
    expect(appAlert.getCurrent()?.type).toBe('success');
  });

  it('clears a field error as soon as the user corrects the field', async () => {
    const renderer = await renderForm();
    await pressText(renderer, i18n.t('coverageRequest.send'));
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.eventNameRequired')),
    ).toBe(true);

    await typeInto(
      renderer,
      i18n.t('coverageRequest.eventPlaceholder'),
      'Diwali Night Event',
    );
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.eventNameRequired')),
    ).toBe(false);
  });

  it('resets the dependent district and city when the state changes', async () => {
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    // Change the state - the previously picked district/city no longer apply.
    await openDropdown(renderer, i18n.t('dashboard.state'));
    await pressText(renderer, 'Haryana');
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(createMock).not.toHaveBeenCalled();
    expect(
      hasText(renderer.root, i18n.t('coverageRequest.districtRequired')),
    ).toBe(true);
  });

  it('does not create duplicate requests when Submit is tapped twice', async () => {
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    await selectAgency(renderer);

    const submitNode = texts(renderer.root, i18n.t('coverageRequest.send'))[0];
    const submit = pressableFor(submitNode);
    await act(async () => {
      // Two synchronous taps before state updates flush.
      submit.props.onPress();
      submit.props.onPress();
    });

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('preserves entered values and surfaces the failure when the backend rejects', async () => {
    createMock.mockRejectedValueOnce(new Error('Server unavailable'));
    agenciesMock.mockResolvedValue([AGENT]);
    const renderer = await renderForm();
    await fillEverythingExceptAgency(renderer);
    await selectAgency(renderer);
    await pressText(renderer, i18n.t('coverageRequest.send'));

    expect(hasText(renderer.root, 'Server unavailable')).toBe(true);
    expect(appAlert.getCurrent()?.type).not.toBe('success');
    const input = renderer.root
      .findAllByType(TextInput)
      .find(node => node.props.placeholder === 'Enter event name');
    expect(input?.props.value).toBe('Diwali Night Event');
  });
});
