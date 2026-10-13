import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Reanimated's real entry pulls native worklets; stub the small surface used.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withSpring: (toValue: unknown) => toValue,
    withTiming: (toValue: unknown) => toValue,
  };
});

import { SlidingTabBar } from '@/components/sliding-tab-bar';

function barProps(index = 0) {
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();
  const names = ['index', 'tasks', 'bills', 'finance', 'more'];
  const props = {
    state: {
      index,
      routes: names.map((name) => ({ key: `${name}-key`, name })),
    },
    navigation: { emit, navigate },
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
  return { props: props as unknown as BottomTabBarProps, emit, navigate };
}

describe('SlidingTabBar', () => {
  it('renders every tab with its label', async () => {
    await render(<SlidingTabBar {...barProps(0).props} />);

    for (const label of ['Home', 'Tasks', 'Bills', 'Finance', 'More']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByTestId('tab-index')).toBeTruthy();
    expect(screen.getByTestId('tab-more')).toBeTruthy();
  });

  it('emits tabPress and navigates when an idle tab is tapped', async () => {
    const { emit, navigate, props } = barProps(0);
    await render(<SlidingTabBar {...props} />);

    await fireEvent.press(screen.getByTestId('tab-tasks'));

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'tasks-key',
      canPreventDefault: true,
    });
    expect(navigate).toHaveBeenCalledWith('tasks');
  });

  it('does not navigate when the active tab is tapped', async () => {
    const { emit, navigate, props } = barProps(2);
    await render(<SlidingTabBar {...props} />);

    await fireEvent.press(screen.getByTestId('tab-bills'));

    expect(emit).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
