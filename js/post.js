// auth.js の auth オブジェクトを利用するように変更

async function createPost(content, quotedPostId = null) {
    const csrfToken = await auth.fetchCsrfToken();
    const deviceId = auth.getDeviceId();

    const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-device-id': deviceId,
            'x-client-type': 'web'
        },
        body: JSON.stringify({ content, quotedPostId })
    });
    return await response.json();
}