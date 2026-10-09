/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  // Unmount so splash/onboarding animations stop before the Jest environment
  // is torn down (otherwise a pending timing frame fires post-teardown and
  // crashes the worker).
  await ReactTestRenderer.act(() => {
    tree?.unmount();
  });
});
