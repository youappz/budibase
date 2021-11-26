import { get, writable, derived } from "svelte/store"
import Manifest from "manifest.json"
import { findComponentById, findComponentPathById } from "../utils/components"
import { devToolsStore } from "./devTools"
import { screenStore } from "./screens"
import { builderStore } from "./builder"

const createComponentStore = () => {
  const store = writable({})

  const derivedStore = derived(
    [builderStore, devToolsStore, screenStore],
    ([$builderState, $devToolsState, $screenState]) => {
      // Avoid any of this logic if we aren't in the builder preview
      if (!$builderState.inBuilder && !$devToolsState.visible) {
        return {}
      }

      // Derive the selected component instance and definition
      let asset
      const { layout, screen, previewType, selectedComponentId } = $builderState
      if ($builderState.inBuilder) {
        asset = previewType === "layout" ? layout : screen
      } else {
        asset = $screenState.activeScreen
      }
      const component = findComponentById(asset?.props, selectedComponentId)
      const prefix = "@budibase/standard-components/"
      const type = component?._component?.replace(prefix, "")
      const definition = type ? Manifest[type] : null

      // Derive the selected component path
      const path =
        findComponentPathById(asset?.props, selectedComponentId) || []

      return {
        selectedComponentInstance: get(store)[selectedComponentId],
        selectedComponent: component,
        selectedComponentDefinition: definition,
        selectedComponentPath: path?.map(component => component._id),
      }
    }
  )

  const registerInstance = (id, instance) => {
    store.update(state => ({
      ...state,
      [id]: instance,
    }))
  }

  const unregisterInstance = id => {
    store.update(state => {
      delete state[id]
      return state
    })
  }

  return {
    ...derivedStore,
    actions: { registerInstance, unregisterInstance },
  }
}

export const componentStore = createComponentStore()
