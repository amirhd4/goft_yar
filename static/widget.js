(function() {
    // Prevent double initialization
    if (window.__goftyar_widget_initialized) return;
    window.__goftyar_widget_initialized = true;

    // Get configuration from script tag attributes
    const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
    const backendUrl = scriptTag ? scriptTag.getAttribute('data-backend-url') || 'http://localhost:8000' : 'http://localhost:8000';
    const primaryColor = scriptTag ? scriptTag.getAttribute('data-primary-color') || '#2563eb' : '#2563eb';
    const widgetTitle = scriptTag ? scriptTag.getAttribute('data-title') || 'پشتیبانی گفت‌یار' : 'پشتیبانی گفت‌یار';

    // Create wrapper container
    const container = document.createElement('div');
    container.id = 'goftyar-widget-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '999999';
    container.style.fontFamily = 'Tahoma, Segoe UI, sans-serif';
    container.style.direction = 'rtl';
    document.body.appendChild(container);

    // Create shadow root for style isolation
    const shadow = container.attachShadow({ mode: 'open' });

    // Styles for shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        .floating-bubble {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: ${primaryColor};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, background-color 0.2s;
            position: absolute;
            bottom: 0;
            right: 0;
        }
        .floating-bubble:hover {
            transform: scale(1.05);
        }
        .floating-bubble svg {
            width: 28px;
            height: 28px;
            fill: white;
            transition: transform 0.2s;
        }
        .floating-bubble.active svg {
            transform: rotate(90deg);
        }
        .chat-panel {
            width: 380px;
            height: 520px;
            max-height: calc(100vh - 100px);
            background-color: #f9fafb;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            position: absolute;
            bottom: 80px;
            right: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
            border: 1px solid #e5e7eb;
        }
        .chat-panel.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }
        .chat-header {
            background-color: ${primaryColor};
            color: white;
            padding: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .chat-header-title {
            font-size: 16px;
            margin: 0;
        }
        .chat-iframe {
            width: 100%;
            height: 100%;
            border: none;
            flex-1;
            background-color: white;
        }
        @media (max-width: 480px) {
            .chat-panel {
                width: calc(100vw - 40px);
                height: calc(100vh - 120px);
                right: 0;
            }
        }
    `;
    shadow.appendChild(style);

    // Bubble HTML
    const bubble = document.createElement('div');
    bubble.className = 'floating-bubble';
    bubble.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
        </svg>
    `;

    // Panel HTML
    const panel = document.createElement('div');
    panel.className = 'chat-panel';

    const header = document.createElement('div');
    header.className = 'chat-header';
    header.innerHTML = `
        <span class="chat-header-title">${widgetTitle}</span>
        <span style="font-size: 11px; opacity: 0.85;">گفت‌یار</span>
    `;

    // Create embedded widget page source on the fly OR use a lightweight iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'chat-iframe';
    // Load a lightweight web-component page or index.html from client with widget mode
    iframe.src = `${backendUrl}/static/widget_frame.html`;

    panel.appendChild(header);
    panel.appendChild(iframe);

    shadow.appendChild(bubble);
    shadow.appendChild(panel);

    // Event handler for toggling widget
    let isWidgetOpen = false;
    bubble.addEventListener('click', () => {
        isWidgetOpen = !isWidgetOpen;
        if (isWidgetOpen) {
            panel.classList.add('open');
            bubble.classList.add('active');
            // Refresh iframe content or connect if necessary
        } else {
            panel.classList.remove('open');
            bubble.classList.remove('active');
        }
    });
})();
