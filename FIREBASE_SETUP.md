# Firebase setup

The portal uses Firebase Authentication and Cloud Firestore. Firebase Storage is not used.

## 1. Add the web app configuration

In Firebase Console, open **Project settings → Your apps → Web app** and copy the config values into `firebase-config.js`.

## 2. Enable login

Open **Authentication → Sign-in method** and enable **Email/Password**.

## 3. Bootstrap the first administrator

This one-time step is intentionally performed in Firebase Console so a public browser cannot promote itself to administrator.

1. In **Authentication → Users**, create the first administrator.
2. Copy the new user's UID.
3. In Firestore, create `users/{UID}` with:

```json
{
  "email": "admin@company.com",
  "displayName": "Administrator",
  "role": "admin",
  "countries": [],
  "active": true
}
```

After this, the administrator can create all other users and country permissions from `setting.html`.

## 4. Deploy security

With Firebase CLI authenticated and the correct project selected:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 5. Portal flow

- `Login.html`: sign in.
- `index.html`: authenticated reports, filtered by assigned countries.
- `setting.html`: administrator-only user and permission management.
- `admin.html`: administrator-only Excel upload and dataset activation.

## 6. Monthly report files

- Upload the Sales workbook once with report type `sales`; it feeds Sales Analysis, IMS FOC Analysis, and Top Variances.
- Upload Selling & Marketing Expenses as report type `sm`.
- Upload P&L as report type `pnl`.
- Each report type keeps its own active dataset.
- Large workbooks are stored in country-secured `reportChunks` documents instead of one Firestore write per Excel row.
