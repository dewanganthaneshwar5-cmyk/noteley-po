/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteType = 'text' | 'voice' | 'drawing';

export interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  color: string;
  fontFamily?: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
  isFavourite?: boolean;
  category?: string;
  isLocked?: boolean;
  pin?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export type LockType = 'none' | 'digit' | 'pattern';

export interface AppLockConfig {
  type: LockType;
  value?: string;
  isEnabled: boolean;
}
