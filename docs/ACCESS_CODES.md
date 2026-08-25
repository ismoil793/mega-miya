# Private access codes

Mega-Miya uses one-time invitation codes for new hosted accounts. Returning users who already exist in the `users` collection can sign in again without another code.

The feature is optional and disabled by default. Enable it in the deployment environment:

```env
REQUIRE_ACCESS_CODE_FOR_NEW_USERS=true
```

When the variable is absent or `false`, new and returning users use the normal GitHub connection flow, and the code-redemption API returns `404`. Changing the flag never forces existing users to enter a code.

## Security model

- Shareable plaintext codes are never stored by the application or committed to the repository.
- MongoDB stores a domain-separated SHA-256 `codeHash` in the `accesscodes` collection.
- Submitting a valid code atomically reserves it for 15 minutes and sets a secure, HTTP-only reservation cookie.
- A reservation prevents a second browser from using the same code concurrently.
- A new GitHub identity atomically changes the record to `used` during OAuth callback processing.
- Used and revoked codes cannot be reserved again. Abandoned reservations become reusable after expiration.
- Existing users are grandfathered; codes control new-account creation rather than every future login.

## Generate and insert codes

Generate ten codes locally:

```bash
npm run access-codes:generate -- 10
```

The command prints plaintext codes and a `mongosh` `insertMany` command containing only hashes. Run that command in the database selected by `MONGODB_URI`. MongoDB creates `accesscodes` automatically if it does not exist.

Keep the plaintext output in a password manager or another private channel. Give each company a separate code and update its `label` before insertion if you want the MongoDB record to identify the intended recipient.

## Revoke or inspect

```javascript
db.accesscodes.find({}, { codeHash: 0, reservedTokenHash: 0 }).sort({ createdAt: -1 })
db.accesscodes.updateOne({ label: "invite-01", status: { $ne: "used" } }, { $set: { status: "revoked", updatedAt: new Date() } })
```

Do not change a `used` code back to `unused`; issue a new code instead so the audit trail remains trustworthy.
