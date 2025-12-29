from playwright.sync_api import sync_playwright

def verify_wiki(page):
    # Go to the Wiki
    page.goto("http://localhost:4173")

    # Wait for content to load
    page.wait_for_selector(".wiki-container")

    # Screenshot main view
    page.screenshot(path="verification/1_main_view.png")

    # Expand Engineering Section (using text selector)
    page.click("text=Engineering")
    page.wait_for_timeout(500)

    # Click on "Architecture" page
    page.click("text=Architecture")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/2_architecture_page.png")

    # Click Edit
    page.click("text=Edit")
    page.wait_for_selector(".wiki-editor-textarea")

    # Type something
    page.fill(".wiki-editor-textarea", "# Architecture\n\nModified content for verify.")
    page.click("text=Save")

    page.wait_for_timeout(500)
    page.screenshot(path="verification/3_after_edit.png")

    # Check History
    page.click("text=History")
    page.wait_for_selector("table")
    page.screenshot(path="verification/4_history.png")

    # Switch User
    page.select_option(".user-switcher select", label="Viewer User (viewer)")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/5_viewer_user.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_wiki(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
