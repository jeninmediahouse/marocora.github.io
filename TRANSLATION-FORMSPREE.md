# Translation Formspree settings

These are proposed dashboard changes, not settings applied by this repository.

## Customer translation requests

Existing endpoint: `https://formspree.io/f/xeajnner` (unchanged).

- Set the successful-submission redirect to `https://marocora.com/translation-thank-you.html`. The new JavaScript already redirects to this page on the current site; the dashboard setting covers native submissions when JavaScript is unavailable.
- Set the customer autoresponse subject and heading to **We Received Your Marocora Translation Request**.
- Set the display sender name to **Marocora**, where supported. Verify the delivered sender name separately; changing website text does not change email sender identity.
- Keep the existing recipient mapping and notification delivery settings.

Suggested customer email body:

> Thank you for requesting translation or language services through Marocora.
>
> We have received your request. The Marocora team will follow up by email regarding availability, pricing, turnaround time, and service details.
>
> Submitting a request does not confirm a booking or final price.
>
> — Marocora

The website now submits the notification subject **New Marocora Translation Service Request**. Check any dashboard subject override or inbox filter that relies on the old JMH subject.

## Translator applications

Existing endpoint: `https://formspree.io/f/meajnwzw` (unchanged).

- Review the redirect and set it to `https://marocora.com/translator-application-thank-you.html` if it still uses the old domain.
- Review any application autoresponse for old JMH branding. Its current dashboard configuration has not been inspected.
- The website now submits the notification subject **New Marocora Translator Application**.

## Verification before calling the migration complete

Local browser tests used mocked Formspree responses; no real requests or emails were sent. After publishing and updating Formspree, verify a controlled request reaches the admin, the customer receives the updated email, and the browser stays on Marocora. Also check the native redirect with JavaScript disabled.
