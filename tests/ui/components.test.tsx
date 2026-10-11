import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '@/components/text-field';
import { TaskItem } from '@/features/tasks/components/task-item';

import { makeTask } from '../helpers/factories';

describe('TaskItem', () => {
  it('renders title, due label and priority badge for a pending task', async () => {
    const task = makeTask({ id: 't1', title: 'Submit tax report', dueAt: '2026-10-11', priority: 'high' });
    await render(
      <TaskItem task={task} today="2026-10-11" onPress={jest.fn()} onToggle={jest.fn()} />,
    );

    expect(screen.getByText('Submit tax report')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('calls onToggle when the checkbox is pressed', async () => {
    const onToggle = jest.fn();
    const task = makeTask({ id: 't2' });
    await render(<TaskItem task={task} today="2026-10-11" onPress={jest.fn()} onToggle={onToggle} />);

    await fireEvent.press(screen.getByTestId('task-checkbox-t2'));
    expect(onToggle).toHaveBeenCalledWith(task);
  });

  it('calls onPress when the task body is pressed', async () => {
    const onPress = jest.fn();
    const task = makeTask({ id: 't3', title: 'Read a book' });
    await render(<TaskItem task={task} today="2026-10-11" onPress={onPress} onToggle={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('task-row-t3'));
    expect(onPress).toHaveBeenCalledWith(task);
  });

  it('shows a completed label instead of priority for completed tasks', async () => {
    const task = makeTask({
      id: 't4',
      title: 'Done thing',
      status: 'completed',
      completedAt: '2026-10-10T06:00:00.000Z',
      priority: 'high',
    });
    await render(<TaskItem task={task} today="2026-10-11" onPress={jest.fn()} onToggle={jest.fn()} />);

    expect(screen.getByText('Completed Yesterday')).toBeTruthy();
    expect(screen.queryByText('High')).toBeNull();
    expect(screen.getByLabelText('Reopen task: Done thing')).toBeTruthy();
  });
});

describe('TextField', () => {
  it('exposes a labeled input and reports typed text', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Title" value="" onChangeText={onChangeText} />);

    expect(screen.getByText('Title')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Title'), 'New task');
    expect(onChangeText).toHaveBeenCalledWith('New task');
  });

  it('shows validation errors and marks optional fields', async () => {
    await render(
      <TextField
        label="Description"
        value=""
        onChangeText={jest.fn()}
        optional
        error="Please enter a task title."
      />,
    );

    expect(screen.getByText('Optional')).toBeTruthy();
    expect(screen.getByText('Please enter a task title.')).toBeTruthy();
  });
});
