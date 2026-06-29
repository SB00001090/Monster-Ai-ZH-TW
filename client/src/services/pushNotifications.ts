import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export class PushNotificationService {
  static async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return;
    }

    try {
      // Request permissions
      await this.requestPermissions();

      // Register with push notifications
      await PushNotifications.register();

      // Listen for push notifications
      this.setupListeners();

      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  private static async requestPermissions() {
    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        console.log('Push notification permissions granted');
      } else {
        console.warn('Push notification permissions denied');
      }
    } catch (error) {
      console.error('Failed to request permissions:', error);
    }
  }

  private static setupListeners() {
    // Handle received push notifications
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      
      // Show local notification
      this.showLocalNotification(
        notification.title || 'MonsterAi',
        notification.body || 'New message'
      );
    });

    // Handle notification action (tap)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed:', notification);
      
      // Handle deep link or action
      const data = notification.notification.data;
      if (data?.route) {
        window.location.href = data.route;
      }
    });

    // Handle registration token
    PushNotifications.addListener('registration', (token) => {
      console.log('Push notification token:', token.value);
      // Send this token to your backend for push notifications
      this.savePushToken(token.value);
    });

    // Handle registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push notification registration error:', error);
    });
  }

  static async showLocalNotification(title: string, body: string, data?: any) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Date.now(),
            smallIcon: 'ic_stat_icon_config_sample',
            largeBody: body,
            summaryText: 'MonsterAi',
            extra: data,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  private static savePushToken(token: string) {
    // Save token to localStorage or send to backend
    localStorage.setItem('push_notification_token', token);
    
    // TODO: Send to backend API
    // await trpc.notifications.registerPushToken.mutate({ token });
  }

  static async getDeliveredNotifications() {
    try {
      // LocalNotifications doesn't have getDelivered method
      // This is a placeholder for future implementation
      console.log('Getting delivered notifications');
      return [];
    } catch (error) {
      console.error('Failed to get delivered notifications:', error);
      return [];
    }
  }

  static async clearNotifications() {
    try {
      // Clear all local notifications
      await LocalNotifications.cancel({ notifications: [] });
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}
