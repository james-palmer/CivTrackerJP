// UI Notifications
const notificationsContainer = document.getElementById('notifications');

// Show notification
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notificationsContainer.appendChild(notification);
  
  // Remove notification after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
  
  return notification;
}

// Push Notifications
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('This browser does not support push notifications', 'warning');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showNotification('Notification permission granted!', 'success');
      return true;
    } else {
      showNotification('Notification permission denied', 'warning');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    showNotification('Failed to request notification permission', 'error');
    return false;
  }
}

async function subscribeToPushNotifications(steamId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showNotification('Push notifications are not supported in this browser', 'warning');
    return false;
  }
  
  try {
    // Request permission first
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) return false;
    
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Get push subscription
    let subscription = await registration.pushManager.getSubscription();
    
    // If no subscription exists, create one
    if (!subscription) {
      // Get server's public key
      const response = await fetch('/api/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID public key');
      }
      
      const vapidPublicKey = await response.text();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }
    
    // Save subscription to server
    await saveSubscription(steamId, subscription);
    
    showNotification('Successfully subscribed to push notifications', 'success');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    showNotification('Failed to subscribe to push notifications', 'error');
    return false;
  }
}

// Helper function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Save subscription to server
async function saveSubscription(steamId, subscription) {
  try {
    const subscriptionData = {
      steamId,
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode.apply(null, 
        new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode.apply(null, 
        new Uint8Array(subscription.getKey('auth'))))
    };
    
    // Try to save using Firestore first
    try {
      await storage.saveSubscription(subscriptionData);
    } catch (error) {
      // If Firestore fails, save to API endpoint
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save subscription to server');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

// Send test notification
function sendTestNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Civilization 6 Turn Tracker', {
      body: 'This is a test notification. Push notifications are working!',
      icon: '/assets/civ6-icon.png'
    });
  } else {
    showNotification('Push notifications are not enabled', 'warning');
  }
}