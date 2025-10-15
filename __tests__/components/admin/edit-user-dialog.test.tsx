/**
 * EditUserDialog Component Test Suite
 * 
 * Tests edit user dialog functionality, form updates, and validation
 * Target Coverage: 80%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditUserDialog from '@/app/components/admin/edit-user-dialog';

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  _id: 'user1',
  phone: '+1234567890',
  profile: { firstName: 'John', lastName: 'Doe' },
  department: 'new',
  role: 'user',
};

describe('EditUserDialog Component', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when open is false', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={false}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('Edit User')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Edit User')).toBeInTheDocument();
      expect(screen.getByText("Update the user's information below.")).toBeInTheDocument();
    });

    it('should populate form with user data', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)') as HTMLInputElement;
      const firstNameInput = screen.getByPlaceholderText('First Name') as HTMLInputElement;
      const lastNameInput = screen.getByPlaceholderText('Last Name') as HTMLInputElement;

      expect(phoneInput.value).toBe('+1234567890');
      expect(firstNameInput.value).toBe('John');
      expect(lastNameInput.value).toBe('Doe');
    });

    it('should render cancel and save buttons', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('Form Updates', () => {
    it('should update phone input', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)') as HTMLInputElement;
      fireEvent.change(phoneInput, { target: { value: '+9999999999' } });
      
      expect(phoneInput.value).toBe('+9999999999');
    });

    it('should update first name input', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const firstNameInput = screen.getByPlaceholderText('First Name') as HTMLInputElement;
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
      
      expect(firstNameInput.value).toBe('Jane');
    });

    it('should update last name input', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const lastNameInput = screen.getByPlaceholderText('Last Name') as HTMLInputElement;
      fireEvent.change(lastNameInput, { target: { value: 'Smith' } });
      
      expect(lastNameInput.value).toBe('Smith');
    });
  });

  describe('Form Submission', () => {
    it('should submit updated user data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { ...mockUser, firstName: 'Jane' } }),
      });

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const firstNameInput = screen.getByPlaceholderText('First Name');
      fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: 'user1',
              phone: '+1234567890',
              firstName: 'Jane',
              lastName: 'Doe',
              department: 'new',
              role: 'user',
            }),
          })
        );
      });
    });

    it('should call onSuccess and close dialog on successful update', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should display error message on failed update', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
      });
    });

    it('should disable buttons while loading', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true }),
        }), 100))
      );

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      fireEvent.click(saveButton);

      expect(saveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should show loading text on save button', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true }),
        }), 100))
      );

      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Action', () => {
    it('should call onOpenChange with false when cancel clicked', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not call onSuccess when cancel clicked', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('User Data Updates', () => {
    it('should update form when user prop changes', () => {
      const { rerender } = render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const newUser = {
        _id: 'user2',
        phone: '+9999999999',
        profile: { firstName: 'Jane', lastName: 'Smith' },
        department: 'used',
        role: 'manager',
      };

      rerender(
        <EditUserDialog
          user={newUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)') as HTMLInputElement;
      const firstNameInput = screen.getByPlaceholderText('First Name') as HTMLInputElement;
      const lastNameInput = screen.getByPlaceholderText('Last Name') as HTMLInputElement;

      expect(phoneInput.value).toBe('+9999999999');
      expect(firstNameInput.value).toBe('Jane');
      expect(lastNameInput.value).toBe('Smith');
    });
  });

  describe('Null User Handling', () => {
    it('should handle null user gracefully', () => {
      render(
        <EditUserDialog
          user={null}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    it('should not submit when user is null', async () => {
      render(
        <EditUserDialog
          user={null}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Validation', () => {
    it('should have required attribute on inputs', () => {
      render(
        <EditUserDialog
          user={mockUser}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');

      expect(phoneInput).toHaveAttribute('required');
      expect(firstNameInput).toHaveAttribute('required');
      expect(lastNameInput).toHaveAttribute('required');
    });
  });
});
