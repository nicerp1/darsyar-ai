// Room invitations from the former app homepage continue to open on the app host.
if (/^#room=[0-9a-f-]{36}(?:\.[0-9a-f]{48})?$/i.test(window.location.hash)) {
    window.location.replace(new URL(window.location.hash, 'https://app.ravandstudy.ir/'));
}
