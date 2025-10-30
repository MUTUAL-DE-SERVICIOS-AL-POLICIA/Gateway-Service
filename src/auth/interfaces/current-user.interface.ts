export interface CurrentUser {
  access_token: string;
  user: {
    username: string;
    name: string;
  };
}
