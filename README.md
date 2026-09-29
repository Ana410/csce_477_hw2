# Login and Account Creation

This project is a basic HTML and JavaScript login application backed by a
Node.js HTTP server and a local SQLite database.

## What it does

- Displays a browser-based login form.
- Lets users create an account with an email and password.
- Validates email and password fields in the browser and on the server.
- Requires an email containing `@` and a password of at least 8 characters.
- Requires matching passwords when creating an account.
- Prevents duplicate email addresses.
- Stores accounts in `data/users.db`.
- Stores salted `scrypt` password hashes instead of plaintext passwords.
- Authenticates users through the server's SQLite database.

## Requirements

- Node.js 22.5 or newer (the application uses Node's built-in `node:sqlite`
  module).

## Run the application

From the project directory, start the server:

```bash
node server.js
```

The server runs on port `3000` by default. Open the application at:

<http://localhost:3000>

## Use the application

1. Select **Create account**.
2. Enter an email, a password with at least 8 characters, and the matching
   confirmation password.
3. Submit the form to save the account.
4. Select **Log in** and enter the same credentials.


