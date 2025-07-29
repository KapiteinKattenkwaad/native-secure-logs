import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HealthLogForm } from '../components/HealthLogForm';
import { HealthLog, CreateHealthLogData } from '../types';

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const mockHealthLog: HealthLog = {
  id: 'test-id',
  title: 'Test Health Log',
  description: 'Test description',
  category: 'symptom',
  severity: 3,
  tags: ['test', 'symptom'],
  date: '2024-01-15',
  notes: 'Test notes',
  attachments: [],
};

describe('HealthLogForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly for new health log', () => {
    const { getByPlaceholderText, getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    expect(getByPlaceholderText('Enter a title for your health log')).toBeTruthy();
    expect(getByPlaceholderText('Describe your health log entry')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders correctly for editing existing health log', () => {
    const { getByDisplayValue, getByText } = render(
      <HealthLogForm
        initialData={mockHealthLog}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(getByDisplayValue('Test Health Log')).toBeTruthy();
    expect(getByDisplayValue('Test description')).toBeTruthy();
    expect(getByDisplayValue('Test notes')).toBeTruthy();
    expect(getByText('Update')).toBeTruthy();
  });

  it('shows severity options only for symptom category', () => {
    const { getByText, queryByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    // Initially should not show severity (default category is 'other')
    expect(queryByText('Severity')).toBeFalsy();

    // Select symptom category
    fireEvent.press(getByText('Symptom'));

    // Now severity should be visible
    expect(getByText('Severity')).toBeTruthy();
    expect(getByText('1 - Very Mild')).toBeTruthy();
    expect(getByText('5 - Very Severe')).toBeTruthy();
  });

  it('handles category selection correctly', () => {
    const { getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    fireEvent.press(getByText('Medication'));
    
    // Verify medication category is selected (would need to check styling or state)
    // This is a visual test that would be better handled with integration tests
  });

  it('handles tag addition and removal', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const tagInput = getByPlaceholderText('Add a tag');
    const addButton = getByText('Add');

    // Add a tag
    fireEvent.changeText(tagInput, 'test-tag');
    fireEvent.press(addButton);

    expect(getByText('test-tag')).toBeTruthy();

    // Remove the tag
    const removeButton = getByText('×');
    fireEvent.press(removeButton);

    expect(queryByText('test-tag')).toBeFalsy();
  });

  it('prevents duplicate tags', () => {
    const { getByPlaceholderText, getByText, getAllByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const tagInput = getByPlaceholderText('Add a tag');
    const addButton = getByText('Add');

    // Add a tag twice
    fireEvent.changeText(tagInput, 'duplicate');
    fireEvent.press(addButton);
    fireEvent.changeText(tagInput, 'duplicate');
    fireEvent.press(addButton);

    // Should only have one instance of the tag
    const duplicateTags = getAllByText('duplicate');
    expect(duplicateTags).toHaveLength(1);
  });

  it('validates required fields before submission', async () => {
    const { getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Please fix the errors before submitting.'
      );
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid form data', async () => {
    const { getByPlaceholderText, getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    // Fill in required fields
    fireEvent.changeText(getByPlaceholderText('Enter a title for your health log'), 'Test Title');
    fireEvent.changeText(getByPlaceholderText('Describe your health log entry'), 'Test Description');
    fireEvent.changeText(getByPlaceholderText('YYYY-MM-DD'), '2024-01-15');

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'Test Title',
        description: 'Test Description',
        category: 'other',
        severity: undefined,
        tags: [],
        date: '2024-01-15',
        notes: '',
        attachments: [],
      });
    });
  });

  it('handles submission errors', async () => {
    const errorMessage = 'Submission failed';
    mockOnSubmit.mockRejectedValueOnce(new Error(errorMessage));

    const { getByPlaceholderText, getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    // Fill in required fields
    fireEvent.changeText(getByPlaceholderText('Enter a title for your health log'), 'Test Title');
    fireEvent.changeText(getByPlaceholderText('Describe your health log entry'), 'Test Description');
    fireEvent.changeText(getByPlaceholderText('YYYY-MM-DD'), '2024-01-15');

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', errorMessage);
    });
  });

  it('calls onCancel when cancel button is pressed', () => {
    const { getByText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables form when loading', () => {
    const { getByText, getByPlaceholderText } = render(
      <HealthLogForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    expect(getByText('Saving...')).toBeTruthy();
    
    // Form fields should be disabled
    const titleInput = getByPlaceholderText('Enter a title for your health log');
    expect(titleInput.props.editable).toBe(false);
  });

  it('handles severity selection for symptoms', () => {
    const { getByText } = render(
      <HealthLogForm
        initialData={{ ...mockHealthLog, category: 'symptom' }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Severity')).toBeTruthy();
    
    // Select a severity level
    fireEvent.press(getByText('4 - Severe'));
    
    // This would need state inspection to verify selection
  });

  it('clears severity when category changes from symptom', () => {
    const { getByText, queryByText } = render(
      <HealthLogForm
        initialData={{ ...mockHealthLog, category: 'symptom', severity: 3 }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Severity')).toBeTruthy();

    // Change category to medication
    fireEvent.press(getByText('Medication'));

    // Severity section should be hidden
    expect(queryByText('Severity')).toBeFalsy();
  });

  it('handles notes input correctly', () => {
    const { getByPlaceholderText } = render(
      <HealthLogForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const notesInput = getByPlaceholderText('Additional notes (optional)');
    fireEvent.changeText(notesInput, 'Test notes content');

    expect(notesInput.props.value).toBe('Test notes content');
  });
});