import { api } from './client';
import type { ApiResponse, User, LoginResponse } from '../store/types';

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<ApiResponse<LoginResponse>> {
  return api.post<LoginResponse>('/auth/register', {
    email,
    password,
    displayName,
  });
}

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<LoginResponse>> {
  return api.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  return api.get<User>('/auth/me');
}
