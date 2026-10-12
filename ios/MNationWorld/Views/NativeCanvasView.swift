import SwiftUI

// MARK: - FC 原生画布骨架（长线工程第一步）
// 目前能力：卡片渲染 + 拖拽移动 + 新增卡片。
// 后续迭代：缩放、多选、分组、边缘剪影、撤销重做（对应网页版 v10.28 功能族）。
// 真机手感调优需要 Mac + Instruments，等有 Mac 后精调。

/// 一张画布卡片。
struct CardBox: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var w: CGFloat
    var h: CGFloat
    var title: String

    init(x: CGFloat = 120, y: CGFloat = 120, w: CGFloat = 220, h: CGFloat = 140, title: String = "新卡片") {
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.title = title
    }
}

struct NativeCanvasView: View {
    /// 模拟网页版 115 格画布尺寸（115 × 24px 宽）。
    private let canvasSize = CGSize(width: 2760, height: 4000)

    @State private var cards: [CardBox] = [
        CardBox(title: "欢迎来到 FluidCanvas"),
        CardBox(x: 420, y: 320, title: "拖动我试试"),
    ]

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            ZStack(alignment: .topLeading) {
                // 网格背景（占位；正式版画 115 格网格线）
                Rectangle()
                    .fill(Color(.systemGray6))
                    .frame(width: canvasSize.width, height: canvasSize.height)

                ForEach($cards) { $card in
                    DraggableCard(card: $card)
                }
            }
        }
        .background(Color(.systemGray6))
        .navigationTitle("FluidCanvas 原生版（开发中）")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    let n = cards.count
                    cards.append(CardBox(x: CGFloat(80 + n * 60), y: CGFloat(80 + n * 40)))
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
    }
}

/// 可拖拽卡片：position 定位 + DragGesture。
struct DraggableCard: View {
    @Binding var card: CardBox
    @State private var dragOrigin: CGSize = .zero

    var body: some View {
        VStack(spacing: 6) {
            Text(card.title)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("拖动 · 后续支持双击编辑")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: card.w, height: card.h)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
        )
        .position(x: card.x + card.w / 2, y: card.y + card.h / 2)
        .gesture(
            DragGesture()
                .onChanged { value in
                    card.x = dragOrigin.width + value.translation.width
                    card.y = dragOrigin.height + value.translation.height
                }
                .onEnded { _ in
                    dragOrigin = CGSize(width: card.x, height: card.y)
                }
        )
        .onAppear {
            dragOrigin = CGSize(width: card.x, height: card.y)
        }
    }
}
