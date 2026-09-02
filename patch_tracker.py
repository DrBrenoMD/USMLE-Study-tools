import re

with open('src/pages/StudyTracker.tsx', 'r') as f:
    code = f.read()

target = r'''                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}'''

replacement = r'''                                )}
                              </div>
                            </div>

                            {/* 5. Metas Diárias Fixas por Dia da Semana (Avançado) */}
                            {resource.frequency === 'daily' && resource.allocationMode === 'item_target' && (
                              <div className="mt-3 pt-3 border-t border-gray-200/80">
                                <label className="block text-[10px] text-gray-600 uppercase font-bold mb-2 flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3 text-indigo-600" />
                                  Fixar Volume por Dia da Semana (Opcional)
                                </label>
                                <p className="text-[9px] text-gray-400 mb-2">
                                  Determine um volume específico de {resource.unit} para determinados dias. O restante será redistribuído. Deixe em branco para cálculo automático.
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {DAYS_OF_WEEK.map(day => (
                                    <div key={day.id} className="flex flex-col items-center">
                                      <span className="text-[10px] font-bold text-gray-500 mb-1">{day.short}</span>
                                      <input
                                        type="number"
                                        placeholder="Auto"
                                        className="w-12 h-8 text-center text-xs font-bold text-indigo-900 bg-white border border-gray-200 rounded focus:border-indigo-500 focus:outline-none placeholder:font-normal placeholder:text-gray-400"
                                        value={resource.fixedVolumeByDayOfWeek?.[day.id] ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? null : Number(e.target.value);
                                          const currentFixed = { ...(resource.fixedVolumeByDayOfWeek || {}) };
                                          if (val === null) {
                                            delete currentFixed[day.id];
                                          } else {
                                            currentFixed[day.id] = val;
                                          }
                                          updateResource(resource.id, { fixedVolumeByDayOfWeek: currentFixed });
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          )}
                        </div>
                      );
                    })}'''

new_code = re.sub(target, replacement, code)
if new_code != code:
    with open('src/pages/StudyTracker.tsx', 'w') as f:
        f.write(new_code)
    print("Replaced successfully")
else:
    print("Could not find target")
