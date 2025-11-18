export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function validateTelegramAuth(data: any): boolean {
  // Базовая проверка структуры данных
  if (!data || !data.id || !data.first_name || !data.hash) {
    return false;
  }
  return true;
}

export function getUserIdFromTelegram(user: TelegramUser): string {
  return `tg_${user.id}`;
}

