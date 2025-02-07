<script>
  import { Layout } from "@budibase/bbui"
  import { store, sortedScreens, userSelectedResourceMap } from "builderStore"
  import NavItem from "components/common/NavItem.svelte"
  import RoleIndicator from "./RoleIndicator.svelte"
  import DropdownMenu from "./DropdownMenu.svelte"
  import { goto } from "@roxi/routify"
  import { getVerticalResizeActions } from "components/common/resizable"
  import NavHeader from "components/common/NavHeader.svelte"

  const [resizable, resizableHandle] = getVerticalResizeActions()

  let searching = false
  let searchValue = ""
  let screensContainer
  let scrolling = false

  $: filteredScreens = getFilteredScreens($sortedScreens, searchValue)

  const handleOpenSearch = async () => {
    screensContainer.scroll({ top: 0, behavior: "smooth" })
  }

  $: {
    if (searching) {
      handleOpenSearch()
    }
  }

  const getFilteredScreens = (screens, searchValue) => {
    return screens.filter(screen => {
      return !searchValue || screen.routing.route.includes(searchValue)
    })
  }

  const handleScroll = e => {
    scrolling = e.target.scrollTop !== 0
  }
</script>

<div class="screens" class:searching use:resizable>
  <div class="header" class:scrolling>
    <NavHeader
      title="Screens"
      placeholder="Search for screens"
      bind:value={searchValue}
      bind:search={searching}
      onAdd={() => $goto("../new")}
    />
  </div>
  <div on:scroll={handleScroll} bind:this={screensContainer} class="content">
    {#if filteredScreens?.length}
      {#each filteredScreens as screen (screen._id)}
        <NavItem
          scrollable
          icon={screen.routing.homeScreen ? "Home" : null}
          indentLevel={0}
          selected={$store.selectedScreenId === screen._id}
          text={screen.routing.route}
          on:click={() => store.actions.screens.select(screen._id)}
          rightAlignIcon
          showTooltip
          selectedBy={$userSelectedResourceMap[screen._id]}
        >
          <DropdownMenu screenId={screen._id} />
          <div slot="icon" class="icon">
            <RoleIndicator roleId={screen.routing.roleId} />
          </div>
        </NavItem>
      {/each}
    {:else}
      <Layout paddingY="none" paddingX="L">
        <div class="no-results">
          There aren't any screens matching that route
        </div>
      </Layout>
    {/if}
  </div>

  <div
    role="separator"
    disabled={searching}
    class="divider"
    class:disabled={searching}
    use:resizableHandle
  />
</div>

<style>
  .screens {
    display: flex;
    flex-direction: column;
    min-height: 147px;
    max-height: calc(100% - 147px);
    position: relative;
    transition: height 300ms ease-out, max-height 300ms ease-out;
    height: 210px;
  }
  .screens.searching {
    max-height: 100%;
    height: 100% !important;
  }

  .header {
    flex-shrink: 0;
    position: relative;
    height: 50px;
    box-sizing: border-box;
    padding: 0 var(--spacing-l);
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: border-bottom 130ms ease-out;
  }
  .header.scrolling {
    border-bottom: var(--border-light);
  }

  .content {
    overflow: auto;
    flex-grow: 1;
  }

  .screens :global(.nav-item) {
    padding-right: 8px !important;
  }

  .icon {
    margin-left: 4px;
    margin-right: 4px;
  }

  .no-results {
    color: var(--spectrum-global-color-gray-600);
  }

  .divider {
    position: absolute;
    bottom: 0;
    transform: translateY(50%);
    height: 16px;
    width: 100%;
  }
  .divider:after {
    content: "";
    position: absolute;
    background: var(--spectrum-global-color-gray-200);
    height: 2px;
    width: 100%;
    top: 50%;
    transform: translateY(-50%);
    transition: background 130ms ease-out;
  }
  .divider:hover {
    cursor: row-resize;
  }
  .divider:hover:after {
    background: var(--spectrum-global-color-gray-300);
  }
  .divider.disabled {
    cursor: auto;
  }
  .divider.disabled:after {
    background: var(--spectrum-global-color-gray-200);
  }
</style>
