# Page snapshot

```yaml
- generic [ref=e4]:
  - img [ref=e7]
  - generic [ref=e9]:
    - heading "Oops! Something went wrong" [level=1] [ref=e10]
    - paragraph [ref=e11]: Don't worry mate, we've logged the error and will fix it soon.
  - generic [ref=e12]:
    - paragraph [ref=e13]: "TypeError: undefined is not an object (evaluating 'window.speechSynthesis.getVoices')"
    - group [ref=e14]:
      - generic "Stack trace" [ref=e15] [cursor=pointer]
  - generic [ref=e16]:
    - button "Try Again" [ref=e17] [cursor=pointer]:
      - img
      - text: Try Again
    - button "Go Home" [ref=e18] [cursor=pointer]:
      - img
      - text: Go Home
```