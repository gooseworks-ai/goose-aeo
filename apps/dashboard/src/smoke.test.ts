import { describe, expect, it } from 'vitest'
import { App } from './App.js'

describe('dashboard app', () => {
  it('exports app component', () => {
    expect(typeof App).toBe('function')
  })
})
