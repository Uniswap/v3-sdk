import { Tick } from './tick'

export interface ListNode<T> {
  value: T
  right?: ListNode<T>
  left?: ListNode<T>
}

interface TickListConstructorArgs {
  ticks?: Tick[]
  current?: Tick
}

export class TickList {
  head?: ListNode<Tick> // right
  tail?: ListNode<Tick> // left
  constructor({ ticks }: TickListConstructorArgs) {
    if (ticks && ticks.length > 0) {
      ticks.sort(({ index: a }, { index: b }) => (a > b ? -1 : 1)).forEach(tick => this.insertUnsorted(tick))
    }
  }
  private insertUnsorted(tick: Tick): void {
    const node: ListNode<Tick> = { value: tick }
    if (this.head === undefined) {
      this.head = node
    } else if (this.tail === undefined) {
      this.tail = node
      this.tail.right = this.head
      this.head.left = this.tail
    } else {
      const priorTail = this.tail
      node.right = priorTail
      priorTail.left = node
      this.tail = node
    }
  }
  insert(tick: Tick): void {
    const node: ListNode<Tick> = { value: tick }
    if (this.head === undefined) {
      this.head = node
    } else if (this.head.value.index < node.value.index) {
      // insert at the beginning
      node.left = this.head
      this.head.right = node
      this.head = node
    } else {
      // find insertion point
      let current: ListNode<Tick> | undefined = { ...this.head }
      while (current.left && current.left.value.index >= node.value.index) {
        current = current.left
      }
      current.right = node
      node.left = current
      if (current.right === undefined) {
        this.head = node
      } else {
        node.right = current.right
      }
      if (current.left === undefined) {
        this.tail = node
      }
    }
  }
  dequeue(): Tick | void {
    if (this.head) {
      const value = this.head.value
      this.head = this.head.left
      if (this.head === undefined) {
        this.tail = undefined
      } else {
        this.head.left = undefined
      }
      return value
    }
  }
  pop(): Tick | void {
    if (this.tail) {
      const value = this.tail.value
      this.tail = this.tail.right
      if (this.tail === undefined) {
        this.head = undefined
      } else {
        this.tail.left = undefined
      }
      return value
    }
  }
  public get values(): Tick[] {
    // returns values starting from tail (lowest tick)
    let current = this.tail
    const result = []
    while (current) {
      result.push(current.value)
      current = current.right
    }
    return result
  }
}
