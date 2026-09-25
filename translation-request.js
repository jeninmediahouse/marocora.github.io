(() => {
    const form = document.getElementById('translation-request-form');
    const button = form.querySelector('button[type="submit"]');
    const status = document.getElementById('submission-status');
    const buttonLabel = button.textContent;
    let submitting = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting || !form.reportValidity()) return;

        submitting = true;
        button.disabled = true;
        button.textContent = 'Sending Request…';
        form.setAttribute('aria-busy', 'true');
        status.hidden = false;
        status.textContent = 'Submitting your request. Please wait.';

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) {
                status.textContent = 'Your request was not accepted. Please check your details and try again.';
                return;
            }

            // Stay on the current site instead of using the old hosted redirect.
            window.location.assign('translation-thank-you.html');
        } catch (error) {
            status.textContent = 'We could not confirm whether your request was received. Check your email before trying again to avoid sending a duplicate.';
        } finally {
            submitting = false;
            button.disabled = false;
            button.textContent = buttonLabel;
            form.removeAttribute('aria-busy');
        }
    });
})();
