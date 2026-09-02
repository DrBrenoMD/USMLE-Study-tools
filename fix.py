with open('src/pages/StudyTracker.tsx', 'r') as f:
    code = f.read()

code = code.replace("""                              </div>
                            )}

                          )}
                        </div>""", """                              </div>
                            )}
                          </div>
                          )}
                        </div>""")

with open('src/pages/StudyTracker.tsx', 'w') as f:
    f.write(code)
