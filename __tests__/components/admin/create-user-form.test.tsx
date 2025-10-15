/**
 * CreateUserForm Component Test Suite
 * 
 * Tests user creation form, validation, and error handling
 * Target Coverage: 80%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateUserForm from '@/app/components/admin/create-user-form';

// Mock fetch
global.fetch = jest.fn();

describe('CreateUserForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the form with all fields', () => {
      render(<CreateUserForm />);

      expect(screen.getByText('Create New User')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Phone Number (e.g., +1234567890)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
      expect(screen.getByText('Select a role')).toBeInTheDocument();
      expect(screen.getByText('Select a department')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    });

    it('should render card with proper styling', () => {
      const { container } = render(<CreateUserForm />);
      const card = container.querySelector('.border-gray-200');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully!' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');

      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      // Select role
      const roleSelect = screen.getByText('Select a role').closest('button');
      if (roleSelect) fireEvent.click(roleSelect);
      await waitFor(() => {
        const userOption = screen.getByText('User');
        fireEvent.click(userOption);
      });

      // Select department
      const deptSelect = screen.getByText('Select a department').closest('button');
      if (deptSelect) fireEvent.click(deptSelect);
      await waitFor(() => {
        const newOption = screen.getByText('New');
        fireEvent.click(newOption);
      });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: '+1234567890',
              firstName: 'John',
              lastName: 'Doe',
              department: 'new',
              role: 'user',
            }),
          })
        );
      });
    });

    it('should display success message on successful creation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully!' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');

      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('User created successfully!')).toBeInTheDocument();
      });
    });

    it('should clear form after successful submission', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully!' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)') as HTMLInputElement;
      const firstNameInput = screen.getByPlaceholderText('First Name') as HTMLInputElement;
      const lastNameInput = screen.getByPlaceholderText('Last Name') as HTMLInputElement;

      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(phoneInput.value).toBe('');
        expect(firstNameInput.value).toBe('');
        expect(lastNameInput.value).toBe('');
      });
    });

    it('should display error message on failed creation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'User already exists' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');

      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('User already exists')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');

      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should have required attribute on phone input', () => {
      render(<CreateUserForm />);
      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      expect(phoneInput).toHaveAttribute('required');
    });

    it('should have required attribute on first name input', () => {
      render(<CreateUserForm />);
      const firstNameInput = screen.getByPlaceholderText('First Name');
      expect(firstNameInput).toHaveAttribute('required');
    });

    it('should have required attribute on last name input', () => {
      render(<CreateUserForm />);
      const lastNameInput = screen.getByPlaceholderText('Last Name');
      expect(lastNameInput).toHaveAttribute('required');
    });
  });

  describe('Input Changes', () => {
    it('should update phone input value', () => {
      render(<CreateUserForm />);
      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)') as HTMLInputElement;
      
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });
      expect(phoneInput.value).toBe('+1234567890');
    });

    it('should update first name input value', () => {
      render(<CreateUserForm />);
      const firstNameInput = screen.getByPlaceholderText('First Name') as HTMLInputElement;
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      expect(firstNameInput.value).toBe('John');
    });

    it('should update last name input value', () => {
      render(<CreateUserForm />);
      const lastNameInput = screen.getByPlaceholderText('Last Name') as HTMLInputElement;
      
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
      expect(lastNameInput.value).toBe('Doe');
    });
  });

  describe('Message Display', () => {
    it('should not show message initially', () => {
      render(<CreateUserForm />);
      const messageElement = screen.queryByText(/User created successfully/);
      expect(messageElement).not.toBeInTheDocument();
    });

    it('should show success message in green', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully!' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const message = screen.getByText('User created successfully!');
        expect(message).toHaveClass('text-green-600');
      });
    });

    it('should show error message in red', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Error occurred' }),
      });

      render(<CreateUserForm />);

      const phoneInput = screen.getByPlaceholderText('Phone Number (e.g., +1234567890)');
      fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const message = screen.getByText('Error occurred');
        expect(message).toHaveClass('text-red-600');
      });
    });
  });

  describe('Role Selection', () => {
    it('should allow selecting user role', async () => {
      render(<CreateUserForm />);

      const roleSelect = screen.getByText('Select a role').closest('button');
      if (roleSelect) fireEvent.click(roleSelect);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });
  });

  describe('Department Selection', () => {
    it('should allow selecting department', async () => {
      render(<CreateUserForm />);

      const deptSelect = screen.getByText('Select a department').closest('button');
      if (deptSelect) fireEvent.click(deptSelect);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('Used')).toBeInTheDocument();
      });
    });
  });
});
