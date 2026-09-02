import re

with open('src/pages/StudyTracker.tsx', 'r') as f:
    content = f.read()

# Fix 1: Around 926
fix1_bad = """                                )}
                              </div>
                            </div>
                            
                            </div>
                          )}
                        </div>"""

fix1_good = """                                )}
                              </div>
                            </div>
                          )}
                        </div>"""
content = content.replace(fix1_bad, fix1_good)

# Fix 2: Around 994
fix2_bad = """                          {mode === 'by_date' && plan.bufferDays > 0 && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {plan.bufferDays}d livres antes da prova
                            </div>
                            
                            </div>
                          )}"""
fix2_good = """                          {mode === 'by_date' && plan.bufferDays > 0 && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {plan.bufferDays}d livres antes da prova
                            </div>
                          )}"""
content = content.replace(fix2_bad, fix2_good)

# Fix 3: Around 1052
fix3_bad = """                          {plan.bufferDays > 0 && (
                            <div className="text-right text-[11px] font-semibold text-blue-700">
                              {plan.bufferDays}d de margem
                            </div>
                            
                            </div>
                          )}"""
fix3_good = """                          {plan.bufferDays > 0 && (
                            <div className="text-right text-[11px] font-semibold text-blue-700">
                              {plan.bufferDays}d de margem
                            </div>
                          )}"""
content = content.replace(fix3_bad, fix3_good)

with open('src/pages/StudyTracker.tsx', 'w') as f:
    f.write(content)
