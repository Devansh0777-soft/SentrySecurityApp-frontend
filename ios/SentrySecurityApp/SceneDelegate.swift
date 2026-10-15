import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

/// Owns the React Native window + factory for the app's UIWindowScene.
///
/// Xcode 27 / iOS SDK 27 requires the UIScene life cycle
/// ("Application failed to launch: UIScene life cycle is required for apps
/// built with this SDK"). The previous pattern — creating the UIWindow and
/// starting React Native in AppDelegate.didFinishLaunching — trips the
/// `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` fatal
/// trap before any JavaScript runs. The factory/delegate are therefore
/// created here, per scene, exactly mirroring the previous AppDelegate setup.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "SentrySecurityApp",
      in: window,
      launchOptions: connectionOptions.userActivities.first?.userInfo as? [AnyHashable: Any]
    )
    self.window = window
    window.makeKeyAndVisible()
  }
}
