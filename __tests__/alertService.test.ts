import { appAlert } from '../src/services/alertService';
import i18n from '../src/localization';

describe('alertService', () => {
  beforeEach(() => {
    appAlert.dismiss();
    jest.useRealTimers();
  });

  it('shows a success alert with an OK fallback button', () => {
    appAlert.success(
      'Guard Added Successfully',
      'The guard has been added successfully.',
    );
    const current = appAlert.getCurrent();
    expect(current).not.toBeNull();
    expect(current?.title).toBe('Guard Added Successfully');
    expect(current?.message).toBe('The guard has been added successfully.');
    expect(current?.type).toBe('success');
    expect(current?.buttons).toHaveLength(1);
    expect(current?.buttons[0].text).toBe(i18n.t('common.ok'));
    expect(current?.buttons[0].variant).toBe('primary');
    expect(current?.cancelable).toBe(true);
  });

  it('keeps the Alert.alert-compatible signature (title, message, buttons, options)', () => {
    appAlert.alert('Remove guard', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: jest.fn() },
    ]);
    const current = appAlert.getCurrent();
    expect(current?.type).toBe('warning'); // inferred from the destructive button
    expect(current?.buttons[0].variant).toBe('secondary');
    expect(current?.buttons[1].variant).toBe('danger');
  });

  it('marks only the first default button as primary', () => {
    appAlert.alert('Plan limit', 'Upgrade to continue.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Upgrade plan', onPress: jest.fn() },
    ]);
    const current = appAlert.getCurrent();
    expect(current?.buttons[0].variant).toBe('secondary');
    expect(current?.buttons[1].variant).toBe('primary');
  });

  it('allows an explicit type to override inference', () => {
    appAlert.alert('Plan limit', 'Upgrade to continue.', undefined, {
      type: 'warning',
    });
    expect(appAlert.getCurrent()?.type).toBe('warning');
  });

  it('deduplicates identical alerts from repeated taps', () => {
    const listener = jest.fn();
    const unsubscribe = appAlert.subscribe(listener);
    appAlert.error('Could not file incident', 'Please try again.');
    const callsAfterFirst = listener.mock.calls.length;
    appAlert.error('Could not file incident', 'Please try again.');
    expect(listener.mock.calls.length).toBe(callsAfterFirst);
    unsubscribe();
  });

  it('dismisses before running the button action', () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    appAlert.success('Site created', undefined, [{ text: 'Done', onPress }]);
    const button = appAlert.getCurrent()?.buttons[0];
    appAlert.handleButtonPress(button!);
    expect(appAlert.getCurrent()).toBeNull();
    expect(onPress).not.toHaveBeenCalled(); // deferred until after dismissal
    jest.runAllTimers();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('builds confirmation dialogs with cancel and confirm actions', () => {
    const onConfirm = jest.fn();
    appAlert.confirm({
      title: 'Remove site',
      message: 'This cannot be undone.',
      confirmText: 'Remove',
      destructive: true,
      onConfirm,
    });
    const current = appAlert.getCurrent();
    expect(current?.type).toBe('warning');
    expect(current?.buttons[0].style).toBe('cancel');
    expect(current?.buttons[1].style).toBe('destructive');
    expect(current?.buttons[1].onPress).toBe(onConfirm);
  });

  it('notifies subscribers when an alert appears and is dismissed', () => {
    const listener = jest.fn();
    const unsubscribe = appAlert.subscribe(listener);
    appAlert.info('Coverage request', 'Sent for review.');
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Coverage request', type: 'info' }),
    );
    appAlert.dismiss();
    expect(listener).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });
});
