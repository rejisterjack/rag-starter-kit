'use client';

import Script from 'next/script';

interface PWAScriptsProps {
  nonce?: string;
}

/**
 * PWA Scripts Component
 * Handles service worker registration and PWA initialization
 *
 * This component should be placed at the end of the body in layout.tsx
 */
export function PWAScripts({ nonce }: PWAScriptsProps) {
  return (
    <Script
      id="pwa-register-sw"
      strategy="afterInteractive"
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PWA service worker registration inline script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            'use strict';
            
            // PWA Registration
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', {
                  scope: '/',
                  updateViaCache: 'imports',
                })
                .then(function(registration) {
                  console.log('[PWA] Service Worker registered with scope:', registration.scope);
                  
                  // Store registration for later use
                  window.__SW_REGISTRATION__ = registration;
                  
                  // Listen for updates
                  registration.addEventListener('updatefound', function() {
                    const newWorker = registration.installing;
                    if (newWorker) {
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          console.log('[PWA] New version available');
                          // Dispatch custom event
                          window.dispatchEvent(new CustomEvent('sw-update-available'));
                        }
                      });
                    }
                  });
                })
                .catch(function(error) {
                  console.error('[PWA] Service Worker registration failed:', error);
                });
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', function(event) {
                  console.log('[PWA] Message from SW:', event.data);
                  
                  if (event.data && event.data.type) {
                    switch (event.data.type) {
                      case 'UPDATE_AVAILABLE':
                        window.dispatchEvent(new CustomEvent('sw-update-available', {
                          detail: event.data
                        }));
                        break;
                      case 'SYNC_COMPLETE':
                        window.dispatchEvent(new CustomEvent('sw-sync-complete', {
                          detail: event.data
                        }));
                        break;
                      case 'CACHE_UPDATED':
                        window.dispatchEvent(new CustomEvent('sw-cache-updated', {
                          detail: event.data
                        }));
                        break;
                    }
                  }
                });
                
                // Listen for controller changes (new SW activated)
                navigator.serviceWorker.addEventListener('controllerchange', function() {
                  console.log('[PWA] Service Worker controller changed');
                  window.dispatchEvent(new CustomEvent('sw-controller-changed'));
                });
              });
              
              // Handle beforeinstallprompt event
              window.addEventListener('beforeinstallprompt', function(e) {
                console.log('[PWA] Before install prompt event fired');
                // Prevent the mini-infobar from appearing on mobile
                e.preventDefault();
                // Store the event for later use
                window.__DEFERRED_INSTALL_PROMPT__ = e;
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('pwa-installable', {
                  detail: e
                }));
              });
              
              // Handle appinstalled event
              window.addEventListener('appinstalled', function() {
                console.log('[PWA] App was installed');
                window.__DEFERRED_INSTALL_PROMPT__ = null;
                window.dispatchEvent(new CustomEvent('pwa-installed'));
              });
            } else {
              console.log('[PWA] Service Workers not supported');
            }
            
            // Expose PWA utilities globally
            window.__PWA__ = {
              // Update service worker
              update: function() {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                }
              },
              
              // Check for updates
              checkUpdate: function() {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
                }
              },
              
              // Clear cache
              clearCache: function() {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
                }
              },
              
              // Get registration
              getRegistration: function() {
                return window.__SW_REGISTRATION__;
              },
              
              // Get install prompt
              getInstallPrompt: function() {
                return window.__DEFERRED_INSTALL_PROMPT__;
              },
              
              // Show install prompt
              showInstallPrompt: async function() {
                const deferredPrompt = window.__DEFERRED_INSTALL_PROMPT__;
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const result = await deferredPrompt.userChoice;
                  window.__DEFERRED_INSTALL_PROMPT__ = null;
                  return result;
                }
                return null;
              },
              
              // Check if standalone
              isStandalone: function() {
                return (
                  window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true
                );
              },
              
              // Check if online
              isOnline: function() {
                return navigator.onLine;
              }
            };
          })();
        `,
      }}
    />
  );
}

// TypeScript declarations for global PWA objects
declare global {
  interface Window {
    /** Service Worker registration */
    __SW_REGISTRATION__?: ServiceWorkerRegistration;
    /** Deferred install prompt event */
    __DEFERRED_INSTALL_PROMPT__?: {
      prompt(): Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    };
    /** PWA utilities */
    __PWA__: {
      update(): void;
      checkUpdate(): void;
      clearCache(): void;
      getRegistration(): ServiceWorkerRegistration | undefined;
      getInstallPrompt(): unknown;
      showInstallPrompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string } | null>;
      isStandalone(): boolean;
      isOnline(): boolean;
    };
  }
}
