//
//  Widget_ExtensionBundle.swift
//  Widget Extension
//
//  Created by Aloha on 2026/09/20.
//

import WidgetKit
import SwiftUI

@main
struct Widget_ExtensionBundle: WidgetBundle {
    var body: some Widget {
        Widget_Extension()
        Widget_ExtensionControl()
        Widget_ExtensionLiveActivity()
    }
}
