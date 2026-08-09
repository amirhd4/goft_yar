(function () {
    // 1. Find the widget script and extract configuration
    const scriptTag = document.currentScript || (() => {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    const apiKey = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
    if (!apiKey) {
        console.error("Goftyar Widget Error: 'data-api-key' attribute is missing on the script tag.");
        return;
    }

    const backendUrl = scriptTag.getAttribute('data-backend-url') || "http://localhost:8000";

    // 2. Create the floating chat bubble button
    const bubble = document.createElement('div');
    bubble.id = 'goftyar-widget-bubble';
    bubble.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
        </svg>
    `;

    // Apply styles to the bubble
    Object.assign(bubble.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#2563eb', // Blue-600
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '999999',
        transition: 'transform 0.3s ease, background-color 0.2s ease',
    });

    // Bubble hover effects
    bubble.onmouseenter = () => { bubble.style.transform = 'scale(1.08)'; bubble.style.backgroundColor = '#1d4ed8'; };
    bubble.onmouseleave = () => { bubble.style.transform = 'scale(1.0)'; bubble.style.backgroundColor = '#2563eb'; };

    // 3. Create the widget iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'goftyar-widget-iframe';
    iframe.src = `${backendUrl}/static/widget_frame.html?api_key=${apiKey}&backend_url=${encodeURIComponent(backendUrl)}`;

    // Apply styles to the iframe
    Object.assign(iframe.style, {
        position: 'fixed',
        bottom: '90px',
        right: '20px',
        width: '380px',
        height: '600px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 120px)',
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
        display: 'none',
        zIndex: '999999',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
    });

    // 4. Append elements to the document
    document.body.appendChild(bubble);
    document.body.appendChild(iframe);

    // 5. Toggle visibility of the chat widget
    let isOpen = false;
    bubble.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            iframe.style.display = 'block';
            setTimeout(() => {
                iframe.style.opacity = '1';
                iframe.style.transform = 'translateY(0)';
            }, 50);
            bubble.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
        } else {
            iframe.style.opacity = '0';
            iframe.style.transform = 'translateY(20px)';
            bubble.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
                </svg>
            `;
            setTimeout(() => {
                iframe.style.display = 'none';
            }, 300);
        }
    });
})();
