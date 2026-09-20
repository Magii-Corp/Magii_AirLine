//
//  Widget_ExtensionLiveActivity.swift
//  Widget Extension
//
//  Created by Aloha on 2026/09/20.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct Widget_ExtensionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct Widget_ExtensionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: Widget_ExtensionAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension Widget_ExtensionAttributes {
    fileprivate static var preview: Widget_ExtensionAttributes {
        Widget_ExtensionAttributes(name: "World")
    }
}

extension Widget_ExtensionAttributes.ContentState {
    fileprivate static var smiley: Widget_ExtensionAttributes.ContentState {
        Widget_ExtensionAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: Widget_ExtensionAttributes.ContentState {
         Widget_ExtensionAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: Widget_ExtensionAttributes.preview) {
   Widget_ExtensionLiveActivity()
} contentStates: {
    Widget_ExtensionAttributes.ContentState.smiley
    Widget_ExtensionAttributes.ContentState.starEyes
}
