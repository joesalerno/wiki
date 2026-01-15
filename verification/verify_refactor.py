from playwright.sync_api import sync_playwright

def verify_wiki(page):
    # Go to home page
    page.goto("http://localhost:5173")

    # Wait for content to load
    page.wait_for_selector(".wiki-brand", state="visible")

    # Wait for the select to have options
    page.wait_for_function("document.querySelector('select').options.length > 0")

    # Select the first option
    page.select_option("select", index=0)

    # Wait for update
    page.wait_for_timeout(500)

    # Take screenshot of main view
    page.screenshot(path="verification/wiki_main.png")

    # Click on a page if exists
    try:
        page.locator(".wiki-nav-link").first.click(timeout=1000)
        page.wait_for_timeout(500)
        page.screenshot(path="verification/wiki_page.png")
    except:
        print("No pages found to click")

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
